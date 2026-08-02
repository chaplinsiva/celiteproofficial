import { NextRequest, NextResponse } from "next/server";
import { plainlyClient } from "@/lib/plainly";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { uploadToR2, getPresignedDownloadUrl, getR2KeyFromUrl } from "@/lib/r2";
import { sendRenderCompletionEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * Check render status and handle completion
 */
export async function GET(request: NextRequest) {
    checkSupabaseConfig();
    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;
    try {
        const { searchParams } = new URL(request.url);
        const renderJobId = searchParams.get("jobId");

        if (!renderJobId) {
            return NextResponse.json(
                { error: "jobId is required" },
                { status: 400 }
            );
        }

        // Get render job from database
        const { data: job, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .select("*, templates(*)")
            .eq("id", renderJobId)
            .single();

        if (jobError || !job) {
            return NextResponse.json(
                { error: "Render job not found" },
                { status: 404 }
            );
        }

        // ── Ownership check ──────────────────────────────────────────────────────
        // Authenticated userId MUST match the job owner.
        // This prevents any user from polling another user's render job.
        if (job.user_id !== userId) {
            console.warn(`Unauthorized status check: user ${userId} tried to access job ${renderJobId} owned by ${job.user_id}`);
            return NextResponse.json(
                { error: "Forbidden: you do not have access to this render job" },
                { status: 403 }
            );
        }

        // If already completed or failed, return current status
        if (job.status === "completed" || job.status === "failed") {
            let outputUrl = job.output_url;
            if (outputUrl && job.status === "completed") {
                try {
                    const key = getR2KeyFromUrl(outputUrl);
                    outputUrl = await getPresignedDownloadUrl(key);
                } catch (err) {
                    console.error(`[Status API] Failed to generate presigned URL for job ${renderJobId}:`, err);
                }
            }

            // Asynchronous self-correcting cleanup if Plainly resources weren't deleted
            if (job.plainly_project_id || job.plainly_render_id) {
                const projectId = job.plainly_project_id;
                const renderId = job.plainly_render_id;
                (async () => {
                    let projectDeleted = false;
                    let renderDeleted = false;
                    try {
                        if (projectId) {
                            await plainlyClient.deleteProject(projectId);
                            projectDeleted = true;
                        }
                    } catch (e) {
                        console.warn(`[Status API Cleanup] Failed to delete project ${projectId}:`, e);
                    }
                    try {
                        if (renderId) {
                            await plainlyClient.deleteRender(renderId);
                            renderDeleted = true;
                        }
                    } catch (e) {
                        console.warn(`[Status API Cleanup] Failed to delete render ${renderId}:`, e);
                    }

                    if (projectDeleted || renderDeleted) {
                        try {
                            await supabaseAdmin
                                .from("render_jobs")
                                .update({
                                    ...(projectDeleted ? { plainly_project_id: null } : {}),
                                    ...(renderDeleted ? { plainly_render_id: null } : {}),
                                })
                                .eq("id", job.id);
                            console.log(`[Status API Cleanup] Successfully nullified Plainly IDs for completed job ${job.id}`);
                        } catch (dbErr) {
                            console.error("[Status API Cleanup] Failed to update DB:", dbErr);
                        }
                    }
                })().catch(err => console.error("[Status API Cleanup] Background cleanup promise rejected:", err));
            }

            return NextResponse.json({
                status: job.status,
                outputUrl: outputUrl,
                thumbnailUrls: job.thumbnail_urls,
                error: job.error_message,
                isSample: job.is_sample || false,
                isSinglePay: job.is_single_pay || false,
                singlePayExpiresAt: job.single_pay_expires_at || null,
                templateId: job.template_id,
                projectId: job.project_id,
                userId: job.user_id,
            });
        }


        // Check Plainly render status
        if (!job.plainly_render_id) {
            return NextResponse.json({
                status: "processing",
                message: "Waiting for render to start...",
            });
        }

        const render = await plainlyClient.getRenderStatus(job.plainly_render_id);
        console.log(`Status check for job ${renderJobId}: Plainly state=${render.state}, DB status=${job.status}`);

        if (render.state === "DONE") {
            // ── SYNCHRONOUS COMPLETION ──────────────────────────────────────────
            // When Plainly reports DONE, we perform the CDN transfer, DB update,
            // credit handling, and Plainly cleanup SYNCHRONOUSLY (using await)
            // before returning the HTTP response.
            //
            // WHY: On serverless platforms (Vercel), the container is frozen or
            // destroyed the instant the HTTP response is sent. Any background
            // promises (fire-and-forget async IIFEs) are killed mid-flight,
            // leaving Plainly resources orphaned and jobs stuck in "processing".
            //
            // By awaiting everything inline, we guarantee the container stays
            // alive until all work is complete. Since Plainly is already DONE,
            // this only takes 2-5 seconds (well within Vercel's request limit).

            const sampleMode = job.is_sample === true;
            const rawVideoUrl = sampleMode && render.outputWatermark
                ? render.outputWatermark
                : render.output;

            if (!rawVideoUrl) {
                // Plainly says DONE but has no output — mark as failed
                await supabaseAdmin
                    .from("render_jobs")
                    .update({
                        status: "failed",
                        error_message: "Render completed but no output URL was available.",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", renderJobId);

                // Cleanup Plainly resources even on no-output failure
                if (job.plainly_project_id) {
                    try { await plainlyClient.deleteProject(job.plainly_project_id); } catch { /* ignore */ }
                }
                if (job.plainly_render_id) {
                    try { await plainlyClient.deleteRender(job.plainly_render_id); } catch { /* ignore */ }
                }
                try {
                    await supabaseAdmin
                        .from("render_jobs")
                        .update({ plainly_project_id: null, plainly_render_id: null })
                        .eq("id", renderJobId);
                } catch { /* ignore */ }

                return NextResponse.json({
                    status: "failed",
                    error: "Render completed but no output was generated. Your credit has not been deducted.",
                });
            }

            // ── CDN Upload (synchronous, with retries) ──────────────────────────
            let r2VideoUrl: string | null = null;
            const CDN_UPLOAD_RETRIES = 3;
            for (let attempt = 1; attempt <= CDN_UPLOAD_RETRIES; attempt++) {
                try {
                    console.log(`[Status Sync] CDN upload attempt ${attempt}/${CDN_UPLOAD_RETRIES} for job ${renderJobId}...`);
                    const videoRes = await fetch(rawVideoUrl);
                    if (!videoRes.ok) throw new Error(`HTTP ${videoRes.status}`);
                    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                    const path = `renders/${job.user_id}/${Date.now()}.mp4`;
                    r2VideoUrl = await uploadToR2(videoBuffer, path, "video/mp4");
                    console.log(`[Status Sync] ✅ CDN upload successful on attempt ${attempt}: ${r2VideoUrl}`);
                    break;
                } catch (uploadErr) {
                    console.error(`[Status Sync] CDN upload attempt ${attempt} failed:`, uploadErr);
                    if (attempt < CDN_UPLOAD_RETRIES) {
                        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                    }
                }
            }

            if (!r2VideoUrl) {
                // CDN upload completely failed — mark job as failed
                console.error(`[Status Sync] CDN upload failed after ${CDN_UPLOAD_RETRIES} attempts for job ${renderJobId}`);
                await supabaseAdmin
                    .from("render_jobs")
                    .update({
                        status: "failed",
                        error_message: `CDN upload failed after ${CDN_UPLOAD_RETRIES} attempts`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", renderJobId);

                // Cleanup Plainly resources
                if (job.plainly_project_id) {
                    try { await plainlyClient.deleteProject(job.plainly_project_id); } catch { /* ignore */ }
                }
                if (job.plainly_render_id) {
                    try { await plainlyClient.deleteRender(job.plainly_render_id); } catch { /* ignore */ }
                }
                try {
                    await supabaseAdmin
                        .from("render_jobs")
                        .update({ plainly_project_id: null, plainly_render_id: null })
                        .eq("id", renderJobId);
                } catch { /* ignore */ }

                return NextResponse.json({
                    status: "failed",
                    error: "Failed to upload video to CDN. Your credit has not been deducted. Please retry.",
                });
            }

            // ── Mark completed in DB ────────────────────────────────────────────
            const updateData: any = {
                status: "completed",
                output_url: r2VideoUrl,
                updated_at: new Date().toISOString(),
            };

            // Transfer thumbnails if available
            if (render.thumbnailUris && render.thumbnailUris.length > 0) {
                try {
                    const cdnThumbnails = await Promise.all(
                        render.thumbnailUris.map(async (uri: string, index: number) => {
                            const res = await fetch(uri);
                            const buffer = Buffer.from(await res.arrayBuffer());
                            const thumbPath = `thumbnails/${job.user_id}/${Date.now()}-${index}.jpg`;
                            return await uploadToR2(buffer, thumbPath, "image/jpeg");
                        })
                    );
                    updateData.thumbnail_urls = cdnThumbnails;
                } catch (e) {
                    console.error("[Status Sync] Thumbnail transfer failed (non-critical):", e);
                }
            }

            await supabaseAdmin
                .from("render_jobs")
                .update(updateData)
                .eq("id", renderJobId);

            console.log(`[Status Sync] Job ${renderJobId} marked as completed.`);

            // ── Track file asset ────────────────────────────────────────────────
            try {
                await supabaseAdmin.from("file_assets").insert({
                    user_id: job.user_id,
                    file_url: r2VideoUrl,
                    file_type: sampleMode ? "preview" : "final",
                    size_bytes: 0,
                });
            } catch (e) {
                console.error("[Status Sync] file_asset tracking failed (non-critical):", e);
            }

            // ── Deduct credits (full renders only) ──────────────────────────────
            if (!sampleMode && job.subscription_id && !job.credits_deducted) {
                try {
                    const template = job.templates;
                    const cost = template?.credit_cost || 20;
                    const { error: creditError } = await supabaseAdmin.rpc("increment_renders_used", {
                        p_subscription_id: job.subscription_id,
                        p_cost: cost,
                    });
                    if (creditError) {
                        // Fallback: read-then-write
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
                    await supabaseAdmin
                        .from("render_jobs")
                        .update({ credits_deducted: true })
                        .eq("id", renderJobId);
                    console.log(`[Status Sync] ✅ ${cost} credits consumed for subscription ${job.subscription_id}`);
                } catch (creditErr) {
                    console.error("[Status Sync] Credit deduction failed (non-critical):", creditErr);
                }
            }

            // ── Log free preview ────────────────────────────────────────────────
            if (sampleMode) {
                try {
                    const { error: profileError } = await supabaseAdmin.rpc("decrement_free_previews", {
                        p_user_id: job.user_id,
                    });
                    if (profileError) {
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
                        data: { templateId: job.template_id, renderJobId: job.id },
                    });
                    console.log(`[Status Sync] ✅ Free preview logged for user ${job.user_id}`);
                } catch (logError) {
                    console.error("[Status Sync] free_preview log failed (non-critical):", logError);
                }
            }

            // ── Cleanup Plainly resources (synchronous) ─────────────────────────
            if (job.plainly_project_id) {
                try {
                    await plainlyClient.deleteProject(job.plainly_project_id);
                    console.log(`[Status Sync] ✅ Plainly project ${job.plainly_project_id} deleted.`);
                } catch (e) {
                    console.warn("[Status Sync] Project cleanup failed (non-critical):", e);
                }
            }
            if (job.plainly_render_id) {
                try {
                    await plainlyClient.deleteRender(job.plainly_render_id);
                    console.log(`[Status Sync] ✅ Plainly render ${job.plainly_render_id} deleted.`);
                } catch (e) {
                    console.warn("[Status Sync] Render cleanup failed (non-critical):", e);
                }
            }

            // Nullify Plainly IDs in DB
            try {
                await supabaseAdmin
                    .from("render_jobs")
                    .update({ plainly_project_id: null, plainly_render_id: null })
                    .eq("id", renderJobId);
            } catch { /* ignore */ }

            // ── Send email (fire-and-forget — non-critical) ─────────────────────
            sendRenderCompletionEmail(renderJobId).catch(mailErr => {
                console.error("[Status Sync] Failed to send render completion email:", mailErr);
            });

            // ── Return completed result with signed URL ─────────────────────────
            let signedOutputUrl = r2VideoUrl;
            try {
                const key = getR2KeyFromUrl(r2VideoUrl);
                signedOutputUrl = await getPresignedDownloadUrl(key);
            } catch (err) {
                console.error(`[Status Sync] Failed to generate presigned URL for job ${renderJobId}:`, err);
            }

            return NextResponse.json({
                status: "completed",
                outputUrl: signedOutputUrl,
                thumbnailUrls: updateData.thumbnail_urls || job.thumbnail_urls,
                isSample: sampleMode,
                isSinglePay: job.is_single_pay || false,
                singlePayExpiresAt: job.single_pay_expires_at || null,
                templateId: job.template_id,
                projectId: job.project_id,
                userId: job.user_id,
            });
        }

        if (render.state === "FAILED") {
            // Mark failed in DB if not already done
            if (job.status !== "failed") {
                await supabaseAdmin
                    .from("render_jobs")
                    .update({
                        status: "failed",
                        error_message: "Render failed in the render engine.",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", renderJobId);
            }

            // Synchronous Plainly cleanup on failure
            if (job.plainly_project_id) {
                try { await plainlyClient.deleteProject(job.plainly_project_id); console.log(`[Status Sync] ✅ Plainly project ${job.plainly_project_id} deleted (FAILED state).`); } catch { /* ignore */ }
            }
            if (job.plainly_render_id) {
                try { await plainlyClient.deleteRender(job.plainly_render_id); console.log(`[Status Sync] ✅ Plainly render ${job.plainly_render_id} deleted (FAILED state).`); } catch { /* ignore */ }
            }
            try {
                await supabaseAdmin
                    .from("render_jobs")
                    .update({ plainly_project_id: null, plainly_render_id: null })
                    .eq("id", renderJobId);
            } catch { /* ignore */ }

            return NextResponse.json({
                status: "failed",
                error: "Render failed. Your credit has not been deducted.",
            });
        }

        // Still processing
        return NextResponse.json({
            status: "processing",
            plainlyState: render.state,
            thumbnailUrls: job.thumbnail_urls,
        });

    } catch (error) {
        console.error("Status check error:", error);
        return NextResponse.json(
            { error: "Failed to check status" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/render/status
 * Deletes a specific render job and its associated cloud video file.
 */
export async function DELETE(request: NextRequest) {
    checkSupabaseConfig();
    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get("jobId");

        if (!jobId) {
            return NextResponse.json(
                { error: "jobId is required" },
                { status: 400 }
            );
        }

        // 1. Fetch job to get R2 URL
        const { data: job, error: fetchError } = await supabaseAdmin
            .from("render_jobs")
            .select("*")
            .eq("id", jobId)
            .eq("user_id", userId)
            .single();

        if (fetchError || !job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        // 2. Delete from R2 if exists
        if (job.output_url && job.output_url.includes("r2.cloudflarestorage.com")) {
            try {
                const url = new URL(job.output_url);
                const path = url.pathname.substring(1); // Remove leading slash
                const { deleteFromR2 } = await import("@/lib/r2");
                await deleteFromR2(path);
            } catch (e) {
                console.error(`Failed to delete R2 video for job ${jobId}:`, e);
            }
        }

        // 3. Delete from DB
        const { error } = await supabaseAdmin
            .from("render_jobs")
            .delete()
            .eq("id", jobId)
            .eq("user_id", userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Render delete error:", error);
        return NextResponse.json({ error: "Failed to delete render" }, { status: 500 });
    }
}
