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
                isSample: job.is_sample || false,
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
            // Get the output URL (watermark for samples, regular for paid renders)
            const outputUrl = job.is_sample && render.outputWatermark
                ? render.outputWatermark
                : (render.output || job.output_url);

            console.log(`Render DONE - outputWatermark: ${render.outputWatermark}, output: ${render.output}, using: ${outputUrl}`);

            // If the DB hasn't been updated yet, update it now
            if (job.status !== "completed" && outputUrl) {
                console.log(`Updating DB status to completed for job ${renderJobId}`);
                await supabaseAdmin
                    .from("render_jobs")
                    .update({
                        status: "completed",
                        output_url: outputUrl,
                        thumbnail_urls: render.thumbnailUris || job.thumbnail_urls,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", renderJobId);
            }

            return NextResponse.json({
                status: "completed",
                outputUrl: outputUrl,
                thumbnailUrls: render.thumbnailUris || job.thumbnail_urls,
            });
        }

        if (render.state === "FAILED") {
            return NextResponse.json({
                status: "failed",
                error: "Render failed in Plainly",
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
