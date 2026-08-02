import { plainlyClient } from "@/lib/plainly";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { uploadToR2, getPresignedDownloadUrl, getR2KeyFromUrl } from "@/lib/r2";
import { sendRenderCompletionEmail } from "@/lib/mailer";

/**
 * Shared render processing logic
 * Can be called from both the initial POST request and queue progression
 *
 * INTEGRITY CONTRACT:
 *  - renders_used is incremented ONLY after the video is confirmed fully rendered and stored.
 *  - free_preview is logged ONLY after a sample render is confirmed fully rendered.
 *  - If Plainly returns DONE but no output URL exists, the job is marked FAILED (not completed).
 *  - If the render stalls beyond MAX_RENDER_WAIT_MS, the job is marked FAILED.
 *  - The subscription credit / free_preview count is NEVER deducted for failed renders.
 */
export async function processRenderJob(renderJobId: string, isSample: boolean = false) {
    let plainlyProjectId: string | null = null;
    const MAX_RETRIES = 3;
    // Maximum time to wait for Plainly to finish — 10 minutes
    const MAX_RENDER_WAIT_MS = 10 * 60 * 1000;

    try {
        // ── 1. Load render job ──────────────────────────────────────────────────
        const { data: job, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .select("*, templates(*)")
            .eq("id", renderJobId)
            .single();

        if (jobError || !job) {
            throw new Error("Render job not found");
        }

        const template = job.templates;
        if (!template || !template.source_url) {
            throw new Error("Template source ZIP not configured");
        }

        // Authoritative sample flag: prefer DB value, fallback to in-memory param
        const sampleMode = job.is_sample === true || isSample;

        // ── 2. Mark as processing ───────────────────────────────────────────────
        await supabaseAdmin
            .from("render_jobs")
            .update({ status: sampleMode ? "sampling" : "processing" })
            .eq("id", renderJobId);

        // ── 3. Create Plainly project (fresh every time, with retries) ──────────
        console.log(`Creating fresh Plainly project for job ${renderJobId}...`);
        const projectBaseName = `render-${template.slug}`;

        let sourceUrl = template.source_url;
        if (sourceUrl && (sourceUrl.includes("r2.cloudflarestorage.com") || sourceUrl.includes("pub-") || sourceUrl.includes("files.celitepro.in") || sourceUrl.includes("cdn.celite.in"))) {
            try {
                const key = getR2KeyFromUrl(sourceUrl);
                sourceUrl = await getPresignedDownloadUrl(key);
            } catch (err) {
                console.error("Failed to generate presigned URL for template source ZIP:", err);
            }
        }

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const projectName = `${projectBaseName}-${renderJobId}-${Date.now()}`;
                const project = await plainlyClient.createProject(
                    projectName,
                    sourceUrl
                );
                plainlyProjectId = project.id;
                break;
            } catch (e) {
                console.error(`Project creation attempt ${i + 1} failed:`, e);
                if (i === MAX_RETRIES - 1) throw e;
                // Exponential backoff: 2s, 4s, 8s
                await new Promise(r => setTimeout(r, Math.pow(2, i + 1) * 1000));
            }
        }

        if (!plainlyProjectId) {
            throw new Error("Failed to get project ID");
        }

        // Store project ID immediately so cleanup can run even on failure
        await supabaseAdmin
            .from("render_jobs")
            .update({ plainly_project_id: plainlyProjectId })
            .eq("id", renderJobId);

        // ── 4. Wait for project analysis ────────────────────────────────────────
        console.log("Verifying project is ready...");
        await plainlyClient.waitForProject(plainlyProjectId);
        console.log("Project is ready for rendering");
        // ── 5. Create Plainly template with dynamic layer bindings ───────────────
        const plainlyTemplate = await plainlyClient.createTemplate(
            plainlyProjectId,
            `template-${template.slug}-${Date.now()}`,
            template.image_placeholders || [],
            template.text_placeholders || []
        );

        // ── 6. Build render options ─────────────────────────────────────────────
        let renderOptions: any = {};
        if (sampleMode) {
            renderOptions = {
                thumbnails: {
                    atSeconds: [0],
                    format: "JPG",
                    fromEncodedVideo: true
                },
                outputFormat: {
                    settingsTemplate: "DRAFT",
                    postEncoding: {
                        type: "scale",
                        scalingPercentage: 25
                    }
                }
            };
        }

        const parameters = job.parameters || {};
        
        // Dynamically sign any private S3/R2 asset URLs within render parameters before starting Plainly render
        const signedParameters = { ...parameters };
        for (const [key, url] of Object.entries(signedParameters)) {
            if (typeof url === "string" && (url.includes("r2.cloudflarestorage.com") || url.includes("pub-") || url.includes("files.celitepro.in") || url.includes("cdn.celite.in"))) {
                try {
                    const s3Key = getR2KeyFromUrl(url);
                    signedParameters[key] = await getPresignedDownloadUrl(s3Key);
                } catch (err) {
                    console.error(`Failed to dynamically sign parameter ${key}:`, err);
                }
            }
        }

        console.log("Starting render with parameters (signed):", JSON.stringify(signedParameters));

        // ── 7. Start render ─────────────────────────────────────────────────────
        const plainlyRender = await plainlyClient.startRender(
            plainlyProjectId,
            plainlyTemplate.id,
            signedParameters as Record<string, string>,
            renderOptions
        );

        await supabaseAdmin
            .from("render_jobs")
            .update({
                plainly_render_id: plainlyRender.id,
                plainly_project_id: plainlyProjectId,
            })
            .eq("id", renderJobId);

        console.log(`${sampleMode ? "Sample" : "Full"} render started successfully for job ${renderJobId}`);

        // ── 8. Wait for completion (with stall-timeout guard) ───────────────────
        console.log(`Waiting for render ${plainlyRender.id} to complete (max ${MAX_RENDER_WAIT_MS / 60000} min)...`);
        const completedRender = await plainlyClient.waitForRender(
            plainlyRender.id,
            MAX_RENDER_WAIT_MS
        );
        console.log(`Render ${plainlyRender.id} completed with state: ${completedRender.state}`);

        // ── 9. Guard: DONE but no output URL → treat as failure ──────────────────
        const rawVideoUrl = sampleMode && completedRender.outputWatermark
            ? completedRender.outputWatermark
            : completedRender.output;

        if (!rawVideoUrl) {
            throw new Error(
                `Plainly returned DONE state for render ${plainlyRender.id} but no output URL was provided. Treating as failure to protect render credit.`
            );
        }

        // ── 10. Transfer assets to CDN ──────────────────────────────────────────
        const updateData: any = {
            status: "completed",
            updated_at: new Date().toISOString(),
        };

        // Transfer thumbnails
        if (completedRender.thumbnailUris && completedRender.thumbnailUris.length > 0) {
            console.log(`Transferring ${completedRender.thumbnailUris.length} thumbnails to CDN...`);
            try {
                const cdnThumbnails = await Promise.all(
                    completedRender.thumbnailUris.map(async (uri, index) => {
                        const res = await fetch(uri);
                        const buffer = Buffer.from(await res.arrayBuffer());
                        const path = `thumbnails/${job.user_id}/${Date.now()}-${index}.jpg`;
                        return await uploadToR2(buffer, path, "image/jpeg");
                    })
                );
                updateData.thumbnail_urls = cdnThumbnails;
            } catch (e) {
                console.error("Failed to transfer thumbnails:", e);
            }
        }

        // Transfer video to CDN — retry up to 3 times, NEVER fall back to Plainly URL
        console.log(`Transferring video to CDN (${sampleMode ? "watermarked preview" : "full render"})...`);
        let r2VideoUrl: string | null = null;
        const VIDEO_UPLOAD_RETRIES = 3;

        for (let attempt = 1; attempt <= VIDEO_UPLOAD_RETRIES; attempt++) {
            try {
                console.log(`CDN upload attempt ${attempt}/${VIDEO_UPLOAD_RETRIES}...`);
                const videoRes = await fetch(rawVideoUrl);
                if (!videoRes.ok) {
                    throw new Error(`Failed to fetch video from Plainly: HTTP ${videoRes.status}`);
                }
                const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                const path = `renders/${job.user_id}/${Date.now()}.mp4`;
                r2VideoUrl = await uploadToR2(videoBuffer, path, "video/mp4");
                console.log(`✅ CDN upload successful on attempt ${attempt}: ${r2VideoUrl}`);
                break; // success
            } catch (uploadErr) {
                console.error(`CDN upload attempt ${attempt} failed:`, uploadErr);
                if (attempt < VIDEO_UPLOAD_RETRIES) {
                    // Exponential backoff: 2s, 4s
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`Retrying CDN upload in ${delay / 1000}s...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }

        // INTEGRITY GUARD: if we couldn't store the video in Cloudflare, fail the job.
        // We NEVER store or return a Plainly URL — those are temporary and violate our
        // availability commitment (they expire) and our CDN-only delivery contract.
        if (!r2VideoUrl) {
            throw new Error(
                `Failed to upload the rendered video to Cloudflare R2 after ${VIDEO_UPLOAD_RETRIES} attempts. ` +
                `The job will be marked as failed so the render credit is NOT deducted. Please retry.`
            );
        }

        updateData.output_url = r2VideoUrl;

        // ── 11. Confirm completion in DB FIRST ──────────────────────────────────
        await supabaseAdmin
            .from("render_jobs")
            .update(updateData)
            .eq("id", renderJobId);

        console.log(`Job ${renderJobId} marked as completed.`);

        // Trigger email notification asynchronously
        sendRenderCompletionEmail(renderJobId).catch(mailErr => {
            console.error("[Processor] Failed to send render completion email:", mailErr);
        });

        // ── 11.5 Track the main output file into file_assets for Retention ────
        try {
            await supabaseAdmin.from("file_assets").insert({
               user_id: job.user_id,
               file_url: updateData.output_url,
               file_type: sampleMode ? "preview" : "final",
               size_bytes: 0, // In a deeper implementation we'd check the head size, 0 provides a fallback allowing retention script to just delete it.
            });
        } catch (e) {
            console.error("Failed to insert file_asset tracking row (non-critical):", e);
        }

        // ── 12. Deduct render credit AFTER confirmed success (atomic) ───────────
        if (!sampleMode && (job.subscription_id || job.entitlement_id)) {
            try {
                const cost = template.credit_cost || 20;

                if (job.entitlement_id) {
                    // ── Legacy entitlement-based render (backward compat for in-progress jobs) ──
                    const { error: entitlementError } = await supabaseAdmin.rpc("decrement_entitlement_credits", {
                        p_entitlement_id: job.entitlement_id,
                        p_cost: cost,
                    });
                    if (entitlementError) {
                        console.error("Entitlement credit deduction RPC failed:", entitlementError);
                    }
                    await supabaseAdmin
                        .from("render_jobs")
                        .update({ credits_deducted: true })
                        .eq("id", renderJobId);
                    console.log(`✅ ${cost} credits consumed from entitlement ${job.entitlement_id} after confirmed success.`);
                } else if (job.subscription_id) {
                    // ── Subscription-based render: deduct from subscription ──
                    // Atomic increment — avoids TOCTOU race between concurrent renders
                    const { error: creditError } = await supabaseAdmin.rpc("increment_renders_used", {
                        p_subscription_id: job.subscription_id,
                        p_cost: cost,
                    });
                    if (creditError) {
                        // Fallback: read-then-write if RPC not available
                        const { data: sub } = await supabaseAdmin
                            .from("user_subscriptions")
                            .select("renders_used")
                            .eq("id", job.subscription_id)
                            .single();
                        if (sub && typeof sub.renders_used === "number") {
                            await supabaseAdmin
                                .from("user_subscriptions")
                                .update({
                                    renders_used: sub.renders_used + cost,
                                    updated_at: new Date().toISOString(),
                                })
                                .eq("id", job.subscription_id);
                        }
                    }
                    // Mark credits deducted on the job row (prevents double-deduction by stall recovery)
                    await supabaseAdmin
                        .from("render_jobs")
                        .update({ credits_deducted: true })
                        .eq("id", renderJobId);
                    console.log(`✅ ${cost} credits consumed for subscription ${job.subscription_id} after confirmed success.`);
                }
            } catch (creditErr) {
                // Non-critical — credit couldn't be updated, log and continue
                console.error("Failed to deduct render credits (non-critical):", creditErr);
            }
        }

        // ── 13. Log free preview AFTER confirmed success ────────────────────────
        if (sampleMode) {
            try {
                // Safely and atomically decrement the free preview count in profiles
                const { error: profileError } = await supabaseAdmin.rpc("decrement_free_previews", {
                    p_user_id: job.user_id,
                });

                if (profileError) {
                    console.log("Decrement RPC error/missing, executing manual decrement:", profileError);
                    // Fallback manual read-modify-write if RPC is not available
                    const { data: profile } = await supabaseAdmin
                        .from("profiles")
                        .select("free_previews_remaining")
                        .eq("id", job.user_id)
                        .single();

                    if (profile) {
                        const newRemaining = Math.max(0, (profile.free_previews_remaining ?? 3) - 1);
                        await supabaseAdmin
                            .from("profiles")
                            .update({ free_previews_remaining: newRemaining })
                            .eq("id", job.user_id);
                    }
                }

                await supabaseAdmin.from("user_logs").insert({
                    user_id: job.user_id,
                    action: "free_preview",
                    data: {
                        templateId: job.template_id,
                        renderJobId: job.id,
                    },
                });
                console.log(`✅ Free preview logged and decremented for user ${job.user_id} after confirmed success.`);
            } catch (logError) {
                // Non-critical — log error but do not fail the render
                console.error("Failed to log free_preview usage (non-critical):", logError);
            }
        }

        // ── 14. Cleanup Plainly resources ───────────────────────────────────────
        // Delete immediately — R2 is strongly consistent so no delay is needed.
        // The old 10s delay caused cleanup to be killed by serverless timeouts.
        console.log(`Cleaning up Plainly resources for job ${renderJobId}...`);

        try {
            await plainlyClient.deleteProject(plainlyProjectId);
            console.log(`✅ Plainly project ${plainlyProjectId} deleted.`);
        } catch (cleanupErr) {
            console.warn("Project cleanup failed (non-critical):", cleanupErr);
        }

        try {
            await plainlyClient.deleteRender(plainlyRender.id);
            console.log(`✅ Plainly render ${plainlyRender.id} deleted.`);
        } catch (cleanupErr) {
            console.warn("Render cleanup failed (non-critical):", cleanupErr);
        }

        // Always nullify Plainly IDs in DB to prevent orphan accumulation
        try {
            await supabaseAdmin
                .from("render_jobs")
                .update({ plainly_project_id: null, plainly_render_id: null })
                .eq("id", renderJobId);
        } catch (dbErr) {
            console.error("Failed to nullify Plainly IDs in DB (non-critical):", dbErr);
        }

        return { success: true, renderId: plainlyRender.id };

    } catch (error) {
        console.error(`Render processing error for job ${renderJobId}:`, error);

        // Mark job as failed — NO credit is deducted (integrity guarantee)
        await supabaseAdmin
            .from("render_jobs")
            .update({
                status: "failed",
                error_message: String(error),
                updated_at: new Date().toISOString(),
            })
            .eq("id", renderJobId);

        // Cleanup Plainly project AND render if they were created
        if (plainlyProjectId) {
            try {
                await plainlyClient.deleteProject(plainlyProjectId);
                console.log(`✅ [Error path] Plainly project ${plainlyProjectId} deleted.`);
            } catch { /* ignore cleanup errors */ }
        }

        // Also delete the render if it was started (plainlyRender may not exist if error was early)
        try {
            // Read the render ID from DB since plainlyRender variable may not be set
            const { data: failedJob } = await supabaseAdmin
                .from("render_jobs")
                .select("plainly_render_id")
                .eq("id", renderJobId)
                .single();
            if (failedJob?.plainly_render_id) {
                await plainlyClient.deleteRender(failedJob.plainly_render_id);
                console.log(`✅ [Error path] Plainly render ${failedJob.plainly_render_id} deleted.`);
            }
        } catch { /* ignore */ }

        // Nullify Plainly IDs in DB to prevent orphan accumulation
        try {
            await supabaseAdmin
                .from("render_jobs")
                .update({ plainly_project_id: null, plainly_render_id: null })
                .eq("id", renderJobId);
        } catch { /* ignore */ }

        throw error;
    }
}
