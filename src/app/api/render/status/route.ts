import { NextRequest, NextResponse } from "next/server";
import { plainlyClient } from "@/lib/plainly";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { uploadToR2 } from "@/lib/r2";
import { processRenderJob } from "@/lib/render-processor";

export const dynamic = "force-dynamic";

/**
 * Process the next job in the queue
 * Called when a render completes or fails to start the next queued job
 */
async function processNextInQueue() {
    try {
        // Find the oldest queued job
        const { data: nextJob, error } = await supabaseAdmin
            .from("render_jobs")
            .select("*")
            .eq("status", "queued")
            .order("created_at", { ascending: true })
            .limit(1)
            .single();

        if (error || !nextJob) {
            console.log("No queued jobs to process");
            return;
        }

        console.log(`Processing next queued job: ${nextJob.id}`);

        // Update status to processing and set started_at
        await supabaseAdmin
            .from("render_jobs")
            .update({
                status: "processing",
                started_at: new Date().toISOString(),
                queue_position: null,
            })
            .eq("id", nextJob.id);

        // Trigger the actual render process
        try {
            await processRenderJob(nextJob.id);
            console.log(`Successfully started render for queued job ${nextJob.id}`);
        } catch (error) {
            console.error(`Failed to process queued job ${nextJob.id}:`, error);
            // Error handling is done in processRenderJob, which updates the job status
        }
    } catch (error) {
        console.error("Error processing next job in queue:", error);
    }
}


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
                error: job.error_message,
            });
        }

        // If queued, return queue position
        if (job.status === "queued") {
            return NextResponse.json({
                status: "queued",
                queuePosition: job.queue_position,
                message: `In queue - Position ${job.queue_position}`,
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

        if (render.state === "DONE" && render.output) {
            // Download and upload to R2
            try {
                const videoRes = await fetch(render.output);
                const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                const timestamp = Date.now();
                const path = `renders/${job.user_id}/${timestamp}.mp4`;
                const r2Url = await uploadToR2(videoBuffer, path, "video/mp4");

                // Update job as completed
                await supabaseAdmin
                    .from("render_jobs")
                    .update({
                        status: "completed",
                        output_url: r2Url,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", renderJobId);

                // Cleanup: Delete temporary Plainly project and render
                if (job.plainly_project_id || job.plainly_render_id) {
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
                        console.error("Failed to cleanup Plainly resources:", cleanupError);
                    }
                }

                // Process next job in queue
                await processNextInQueue();

                return NextResponse.json({
                    status: "completed",
                    outputUrl: r2Url,
                });
            } catch (uploadError) {
                console.error("Failed to upload to R2:", uploadError);

                // Still return Plainly URL if R2 fails
                await supabaseAdmin
                    .from("render_jobs")
                    .update({
                        status: "completed",
                        output_url: render.output,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", renderJobId);

                return NextResponse.json({
                    status: "completed",
                    outputUrl: render.output,
                });
            }
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

            // Process next job in queue
            await processNextInQueue();

            return NextResponse.json({
                status: "failed",
                error: "Render failed",
            });
        }

        // Still processing
        return NextResponse.json({
            status: "processing",
            plainlyState: render.state,
        });

    } catch (error) {
        console.error("Status check error:", error);
        return NextResponse.json(
            { error: "Failed to check status", details: String(error) },
            { status: 500 }
        );
    }
}
