import { NextRequest, NextResponse } from "next/server";
import { plainlyClient } from "@/lib/plainly";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { uploadToR2 } from "@/lib/r2";
import { processRenderJob } from "@/lib/render-processor";

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

        // Get render job from database
        const { data: job, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .select("*")
            .eq("id", renderJobId)
            .single();

        if (jobError || !job) {
            return NextResponse.json(
                { error: "Render job not found" },
                { status: 404 }
            );
        }

        // If already completed or failed, return current status
        if (job.status === "completed" || job.status === "failed") {
            return NextResponse.json({
                status: job.status,
                outputUrl: job.output_url,
                thumbnailUrls: job.thumbnail_urls,
                error: job.error_message,
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
        console.log(`[DEBUG] Plainly Response for ${job.plainly_render_id}:`, JSON.stringify(render, null, 2));
        console.log(`Plainly render ${job.plainly_render_id} state: ${render.state}`, {
            hasThumbnails: !!render.thumbnailUris,
            thumbnailCount: render.thumbnailUris?.length,
            hasOutput: !!render.output
        });

        // If thumbnails are available on Plainly, transfer them to our CDN
        const hasPlainlyThumbnails = render.thumbnailUris &&
            render.thumbnailUris.length > 0 &&
            render.thumbnailUris.some(url => url.includes("plainlyvideos.com"));

        if (hasPlainlyThumbnails) {
            console.log(`[DEBUG] Transferring ${render.thumbnailUris?.length} thumbnails to CDN for job ${renderJobId}`);
            try {
                const cdnThumbnailUrls = await Promise.all(
                    render.thumbnailUris!.map(async (uri, index) => {
                        const res = await fetch(uri);
                        if (!res.ok) throw new Error(`Failed to download thumbnail: ${res.statusText}`);
                        const buffer = Buffer.from(await res.arrayBuffer());
                        const timestamp = Date.now();
                        const path = `thumbnails/${job.user_id}/${timestamp}-${index}.jpg`;
                        return await uploadToR2(buffer, path, "image/jpeg");
                    })
                );

                const { error: updateError } = await supabaseAdmin
                    .from("render_jobs")
                    .update({ thumbnail_urls: cdnThumbnailUrls })
                    .eq("id", renderJobId);

                if (!updateError) {
                    job.thumbnail_urls = cdnThumbnailUrls;
                    console.log(`[DEBUG] Successfully migrated thumbnails to CDN for job ${renderJobId}`);
                }
            } catch (cdnError) {
                console.error(`[ERROR] Failed to transfer thumbnails to CDN for job ${renderJobId}:`, cdnError);
            }
        }

        if (render.state === "DONE") {
            // Update job status to completed first
            const updateData: any = {
                status: "completed",
                updated_at: new Date().toISOString(),
            };

            // If it's a video render, handle video upload
            if (render.output) {
                try {
                    console.log(`[DEBUG] Transferring video to CDN for job ${renderJobId}`);
                    const videoRes = await fetch(render.output);
                    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                    const timestamp = Date.now();
                    const path = `renders/${job.user_id}/${timestamp}.mp4`;
                    const r2Url = await uploadToR2(videoBuffer, path, "video/mp4");
                    updateData.output_url = r2Url;
                    job.output_url = r2Url;
                } catch (uploadError) {
                    console.error("Failed to upload video to R2:", uploadError);
                    updateData.output_url = render.output; // Fallback to Plainly URL
                    job.output_url = render.output;
                }
            }

            // Sync with DB
            await supabaseAdmin
                .from("render_jobs")
                .update(updateData)
                .eq("id", renderJobId);

            // Cleanup Plainly resources
            try {
                if (job.plainly_project_id) {
                    await plainlyClient.deleteProject(job.plainly_project_id);
                    console.log(`Cleaned up Plainly project: ${job.plainly_project_id}`);
                }
                if (job.plainly_render_id) {
                    await plainlyClient.deleteRender(job.plainly_render_id);
                    console.log(`Cleaned up Plainly render: ${job.plainly_render_id}`);
                }
            } catch (cleanupError) {
                console.warn("Non-critical cleanup failed:", cleanupError);
            }

            return NextResponse.json({
                status: "completed",
                outputUrl: job.output_url,
                thumbnailUrls: job.thumbnail_urls,
            });
        }

        if (render.state === "FAILED") {
            await supabaseAdmin
                .from("render_jobs")
                .update({
                    status: "failed",
                    error_message: "Render failed in Plainly",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", renderJobId);

            // Cleanup on failure too
            if (job.plainly_project_id || job.plainly_render_id) {
                try {
                    if (job.plainly_project_id) await plainlyClient.deleteProject(job.plainly_project_id);
                    if (job.plainly_render_id) await plainlyClient.deleteRender(job.plainly_render_id);
                } catch { }
            }

            return NextResponse.json({
                status: "failed",
                error: "Render failed",
            });
        }

        // Still processing
        return NextResponse.json({
            status: job.status,
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
