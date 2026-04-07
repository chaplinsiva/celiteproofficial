import { NextRequest, NextResponse } from "next/server";
import { plainlyClient } from "@/lib/plainly";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * Check render status and handle completion
 */
export async function GET(request: NextRequest) {
    checkSupabaseConfig();
    try {
        const { searchParams } = new URL(request.url);
        const renderJobId = searchParams.get("jobId");

        if (!renderJobId) {
            return NextResponse.json(
                { error: "jobId is required" },
                { status: 400 }
            );
        }

        // Optional user ownership check (confidentiality)
        const userId = searchParams.get("userId");

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
        // If a userId is provided, it MUST match the job owner.
        // This prevents any user from polling another user's render job.
        if (userId && job.user_id !== userId) {
            console.warn(`Unauthorized status check: user ${userId} tried to access job ${renderJobId} owned by ${job.user_id}`);
            return NextResponse.json(
                { error: "Forbidden: you do not have access to this render job" },
                { status: 403 }
            );
        }

        // If already completed or failed, return current status
        if (job.status === "completed" || job.status === "failed") {
            return NextResponse.json({
                status: job.status,
                outputUrl: job.output_url,
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
            // render-processor.ts is the SOLE authority for uploading to CDN and
            // marking the job completed. HOWEVER, if the background processor
            // crashed mid-flight (serverless cold restart, OOM, etc.), the job
            // would stay stuck in 'processing' forever even though Plainly is DONE.
            //
            // STALL RECOVERY: instead of re-running processRenderJob() (which
            // creates an entirely NEW Plainly project and duplicate render),
            // we do an inline CDN-upload recovery using the EXISTING Plainly
            // output that is already available.
            const startedAt = job.started_at ? new Date(job.started_at).getTime() : 0;
            const stalledFor = Date.now() - startedAt;
            const STALL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

            if (stalledFor > STALL_THRESHOLD_MS) {
                console.warn(`Job ${renderJobId} appears stalled (Plainly DONE, started ${Math.round(stalledFor / 60000)}m ago, DB still '${job.status}'). Running inline CDN recovery.`);

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

                    return NextResponse.json({
                        status: "failed",
                        error: "Render completed but no output was generated. Your credit has not been deducted.",
                    });
                }

                // Attempt CDN upload inline (fire-and-forget so we don't block the poll response)
                (async () => {
                    try {
                        console.log(`[Stall Recovery] Downloading video from Plainly for job ${renderJobId}...`);
                        const videoRes = await fetch(rawVideoUrl);
                        if (!videoRes.ok) throw new Error(`HTTP ${videoRes.status}`);
                        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                        const path = `renders/${job.user_id}/${Date.now()}.mp4`;
                        const r2VideoUrl = await uploadToR2(videoBuffer, path, "video/mp4");
                        console.log(`[Stall Recovery] CDN upload successful: ${r2VideoUrl}`);

                        // Mark completed in DB
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
                                console.error("[Stall Recovery] Thumbnail transfer failed (non-critical):", e);
                            }
                        }

                        await supabaseAdmin
                            .from("render_jobs")
                            .update(updateData)
                            .eq("id", renderJobId);

                        // Track file asset
                        try {
                            await supabaseAdmin.from("file_assets").insert({
                                user_id: job.user_id,
                                file_url: r2VideoUrl,
                                file_type: sampleMode ? "preview" : "final",
                                size_bytes: 0,
                            });
                        } catch (e) {
                            console.error("[Stall Recovery] file_asset tracking failed (non-critical):", e);
                        }

                        // Deduct credits for full renders
                        if (!sampleMode && job.subscription_id) {
                            try {
                                const template = job.templates;
                                const cost = template?.credit_cost || 20;
                                const { data: sub } = await supabaseAdmin
                                    .from("user_subscriptions")
                                    .select("renders_used")
                                    .eq("id", job.subscription_id)
                                    .single();

                                if (sub !== null) {
                                    await supabaseAdmin
                                        .from("user_subscriptions")
                                        .update({
                                            renders_used: (sub.renders_used || 0) + cost,
                                            updated_at: new Date().toISOString(),
                                        })
                                        .eq("id", job.subscription_id);
                                    console.log(`[Stall Recovery] ${cost} credits consumed for subscription ${job.subscription_id}`);
                                }
                            } catch (creditErr) {
                                console.error("[Stall Recovery] Credit deduction failed (non-critical):", creditErr);
                            }
                        }

                        // Log free preview
                        if (sampleMode) {
                            try {
                                await supabaseAdmin.from("user_logs").insert({
                                    user_id: job.user_id,
                                    action: "free_preview",
                                    data: { templateId: job.template_id, renderJobId: job.id },
                                });
                            } catch (e) {
                                console.error("[Stall Recovery] free_preview log failed (non-critical):", e);
                            }
                        }

                        // Cleanup Plainly resources
                        if (job.plainly_project_id) {
                            try { await plainlyClient.deleteProject(job.plainly_project_id); } catch { /* ignore */ }
                        }
                        try { await plainlyClient.deleteRender(job.plainly_render_id); } catch { /* ignore */ }

                        console.log(`[Stall Recovery] Job ${renderJobId} fully recovered and marked completed.`);
                    } catch (recoveryErr) {
                        console.error(`[Stall Recovery] CDN upload failed for job ${renderJobId}:`, recoveryErr);
                        await supabaseAdmin
                            .from("render_jobs")
                            .update({
                                status: "failed",
                                error_message: `Stall recovery failed: ${String(recoveryErr)}`,
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", renderJobId);
                    }
                })();
            }

            // Always return 'processing' until the DB confirms completion with a CDN URL.
            // The next poll will pick up the completed/failed state from the DB.
            return NextResponse.json({
                status: "processing",
                plainlyState: render.state,
                message: "Finishing up \u2014 almost done!",
                thumbnailUrls: job.thumbnail_urls,
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
            { error: "Failed to check status", details: String(error) },
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
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get("jobId");
        const userId = searchParams.get("userId");

        if (!jobId || !userId) {
            return NextResponse.json(
                { error: "jobId and userId are required" },
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
