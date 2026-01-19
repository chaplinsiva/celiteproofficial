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

        // Check Plainly render status only if DB says processing
        if (!job.plainly_render_id) {
            return NextResponse.json({
                status: "processing",
                message: "Waiting for render to start...",
            });
        }

        const render = await plainlyClient.getRenderStatus(job.plainly_render_id);

        if (render.state === "DONE") {
            // The background process should handle this, but if the user reaches here
            // and the DB isn't updated, let's just report the results from Plainly.
            // We don't perform cleanup here anymore to avoid race conditions with the processor.
            return NextResponse.json({
                status: "completed",
                outputUrl: render.output || job.output_url,
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
