import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { processRenderJob } from "@/lib/render-processor";


export const dynamic = "force-dynamic";

/**
 * Sample Render API
 * 
 * Steps:
 * 1. Validate request & get template data
 * 2. Create render job record (status: sampling)
 * 3. Start Plainly render process in sample mode
 * 4. Return immediately, client polls for status
 */

export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const authResult = await getAuthenticatedUser(request);
        if (authResult instanceof Response) return authResult;
        const { userId } = authResult;

        const body = await request.json();
        const { templateId, parameters } = body;

        console.log("=== SAMPLE RENDER REQUEST START ===");
        console.log("Request body:", { templateId, userId });

        if (!templateId) {
            return NextResponse.json(
                { error: "templateId is required" },
                { status: 400 }
            );
        }

        // Step 1: Get template from database
        const { data: template, error: templateError } = await supabaseAdmin
            .from("templates")
            .select("*")
            .eq("id", templateId)
            .single();

        if (templateError || !template) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            );
        }

        if (!template.source_url) {
            return NextResponse.json(
                { error: "Template source ZIP not configured" },
                { status: 400 }
            );
        }

        // Check subscription — only PAID subscribers get sample renders (unlimited). Free and Welcome Gift users cannot generate sample renders.
        const { data: activeSubs } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id, status, valid_until, plan:subscription_plans(name, price_monthly)")
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", new Date().toISOString());

        const hasPaidSubscription = (activeSubs || []).some(
            (s: any) => (s.plan?.price_monthly || 0) > 0 && s.plan?.name !== "Welcome Gift"
        );

        if (!hasPaidSubscription) {
            return NextResponse.json(
                { error: "Free preview is only available for paid subscription members. Free users can use their welcome credits for HD renders." },
                { status: 403 }
            );
        }

        // ── Idempotency guard: prevent duplicate sample renders on refresh ──
        // If the user already has an active sampling job for the same template,
        // return the existing job instead of creating a new one.
        const { data: existingJob } = await supabaseAdmin
            .from("render_jobs")
            .select("id")
            .eq("user_id", userId)
            .eq("template_id", templateId)
            .eq("is_sample", true)
            .in("status", ["pending", "processing", "sampling"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingJob) {
            console.log(`Idempotency: returning existing active sample job ${existingJob.id} instead of creating a duplicate.`);
            return NextResponse.json({
                success: true,
                renderJobId: existingJob.id,
                message: "Sample render is already in progress"
            });
        }

        // Clean up presigned URLs from parameters before storing them in render_jobs
        const cleanedParameters = { ...(parameters || {}) };
        for (const [key, url] of Object.entries(cleanedParameters)) {
            if (typeof url === "string" && (url.includes("r2.cloudflarestorage.com") || url.includes("pub-") || url.includes("files.celitepro.in") || url.includes("cdn.celite.in"))) {
                try {
                    const parsedUrl = new URL(url);
                    cleanedParameters[key] = parsedUrl.origin + parsedUrl.pathname;
                } catch (e) {
                    if (url.includes("?")) {
                        cleanedParameters[key] = url.split("?")[0];
                    }
                }
            }
        }

        // Step 2: Create render job record (Sampling)
        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert({
                user_id: userId,
                template_id: templateId,
                status: "sampling",
                is_sample: true,
                started_at: new Date().toISOString(),
                parameters: cleanedParameters,
            })
            .select()
            .single();

        if (jobError || !renderJob) {
            console.error("Render job creation failed:", jobError);
            return NextResponse.json(
                { error: "Failed to create render job" },
                { status: 500 }
            );
        }

        // Step 3: Start Plainly render process in sample mode (non-blocking)
        // NOTE: free_preview usage is logged INSIDE render-processor.ts after confirmed success.
        // This ensures free trial count is NOT deducted for failed renders.
        processRenderJob(renderJob.id, true).catch((err) => {
            console.error(`Error in background sample render processing for job ${renderJob.id}:`, err);
        });

        return NextResponse.json({
            success: true,
            renderJobId: renderJob.id,
            message: "Sample render started successfully"
        });

    } catch (error) {
        console.error("Sample render request error:", error);
        return NextResponse.json(
            { error: "Failed to create sample render job" },
            { status: 500 }
        );
    }
}
