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
