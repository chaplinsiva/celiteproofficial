import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
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
        const authResult = await getAuthenticatedUser(request);
        if (authResult instanceof Response) return authResult;
        const { userId } = authResult;

        const body = await request.json();
        const { jobId } = body;

        if (!jobId) {
            return NextResponse.json(
                { error: "jobId is required" },
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

        // 3. Re-validate subscription so an expired/exhausted user cannot retry for free
        if (!job.is_sample && job.subscription_id) {
            const now = new Date().toISOString();
            const { data: sub } = await supabaseAdmin
                .from("user_subscriptions")
                .select("*, plan:subscription_plans(name, render_limit)")
                .eq("id", job.subscription_id)
                .single();

            // Load template dynamic cost for precise credit validation
            const { data: template } = await supabaseAdmin
                .from("templates")
                .select("credit_cost")
                .eq("id", job.template_id)
                .single();

            const plan = sub?.plan as any;
            const cost = template?.credit_cost ?? 20;

            // Account for in-flight renders to prevent over-commitment
            let activeCost = 0;
            if (plan?.render_limit) {
                const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
                const { data: activeJobs } = await supabaseAdmin
                    .from("render_jobs")
                    .select("template_id, templates(credit_cost)")
                    .eq("user_id", userId)
                    .eq("is_sample", false)
                    .in("status", ["pending", "processing", "queued"])
                    .gte("created_at", fifteenMinutesAgo);

                activeCost = activeJobs?.reduce(
                    (sum: number, j: any) => sum + (j.templates?.credit_cost || 20), 0
                ) || 0;
            }

            const creditsOk = !plan?.render_limit || (sub.renders_used + activeCost + cost) <= plan.render_limit;
            
            // Check status correctly allowing expired or cancelled sub remaining credits
            const stillActive = sub?.status === "active" && sub?.valid_until >= now;
            const isSubExpired = sub?.valid_until < now || sub?.status === "expired" || sub?.status === "cancelled";
            const expiredWithCredits = isSubExpired && creditsOk;

            if (!stillActive && !expiredWithCredits) {
                return NextResponse.json(
                    { error: "Your subscription has expired or credits are exhausted. Please renew to retry." },
                    { status: 402 }
                );
            }
        }

        // 4. Clean up old Plainly resources before retry (prevent orphaned projects)
        if (job.plainly_project_id) {
            try {
                const { plainlyClient } = await import("@/lib/plainly");
                await plainlyClient.deleteProject(job.plainly_project_id);
                console.log(`Cleaned up old Plainly project ${job.plainly_project_id} before retry.`);
            } catch (e) {
                console.warn(`Failed to delete old Plainly project on retry (non-critical):`, e);
            }
        }
        if (job.plainly_render_id) {
            try {
                const { plainlyClient } = await import("@/lib/plainly");
                await plainlyClient.deleteRender(job.plainly_render_id);
                console.log(`Cleaned up old Plainly render ${job.plainly_render_id} before retry.`);
            } catch {
                // ignore cleanup errors
            }
        }

        // 5. Reset job to processing state
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
            { error: "Failed to retry render" },
            { status: 500 }
        );
    }
}
