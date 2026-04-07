import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { processRenderJob } from "@/lib/render-processor";

export const dynamic = "force-dynamic";

/**
 * Retry a failed render job
 * POST /api/render/retry
 *
 * This reuses the SAME render job record (same parameters, same payment link).
 * No additional payment or credit deduction is needed — the original payment
 * or subscription credit was never consumed because the render failed.
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const body = await request.json();
        const { jobId, userId } = body;

        if (!jobId || !userId) {
            return NextResponse.json(
                { error: "jobId and userId are required" },
                { status: 400 }
            );
        }

        // 1. Fetch the job and verify ownership
        const { data: job, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .select("*")
            .eq("id", jobId)
            .eq("user_id", userId)
            .single();

        if (jobError || !job) {
            return NextResponse.json(
                { error: "Render job not found" },
                { status: 404 }
            );
        }

        // 2. Only allow retry on failed jobs
        if (job.status !== "failed") {
            return NextResponse.json(
                { error: `Cannot retry a job with status '${job.status}'. Only failed jobs can be retried.` },
                { status: 400 }
            );
        }

        // 3. Reset job to processing state
        const { error: updateError } = await supabaseAdmin
            .from("render_jobs")
            .update({
                status: job.is_sample ? "sampling" : "processing",
                error_message: null,
                plainly_render_id: null,
                plainly_project_id: null,
                output_url: null,
                thumbnail_urls: null,
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

        if (updateError) {
            console.error("Failed to reset render job for retry:", updateError);
            return NextResponse.json(
                { error: "Failed to reset render job" },
                { status: 500 }
            );
        }

        console.log(`Retrying render job ${jobId} (sample=${job.is_sample})`);

        // 4. Fire render processor in background
        processRenderJob(jobId, job.is_sample || false).catch((err) => {
            console.error(`Retry render processing error for job ${jobId}:`, err);
        });

        return NextResponse.json({
            success: true,
            renderJobId: jobId,
            message: "Render retry started successfully",
        });

    } catch (error) {
        console.error("Retry render error:", error);
        return NextResponse.json(
            { error: "Failed to retry render", details: String(error) },
            { status: 500 }
        );
    }
}
