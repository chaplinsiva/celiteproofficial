// agent-notes: { ctx: "Render API with multi-subscription credit checking and gift stacking", deps: ["src/lib/supabase-admin.ts", "src/lib/render-processor.ts", "src/lib/subscription-credits.ts"], state: active, last: "sato@2026-08-24" }
import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { processRenderJob } from "@/lib/render-processor";
import { aggregateActiveSubscriptions, pickSubscriptionForRender } from "@/lib/subscription-credits";


export const dynamic = "force-dynamic";

/**
 * Render API - Core Orchestration Pipeline
 * 
 * Steps:
 * 1. Validate request & get template data
 * 2. Create render job record
 * 3. Create dynamic Plainly project from template ZIP
 * 4. Wait for project analysis
 * 5. Create manual template with layer bindings
 * 6. Start render with user parameters
 * 7. Return immediately, client polls for status
 */

export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const authResult = await getAuthenticatedUser(request);
        if (authResult instanceof Response) return authResult;
        const { userId } = authResult;

        const body = await request.json();
        const { templateId, parameters, projectId } = body;

        console.log("=== RENDER REQUEST START ===");
        console.log("Request body:", { templateId, userId, projectId, parametersCount: Object.keys(parameters || {}).length });

        if (!templateId) {
            return NextResponse.json(
                { error: "templateId is required" },
                { status: 400 }
            );
        }

        // Step 1: Get template from database
        console.log("Step 1: Fetching template...");
        const { data: template, error: templateError } = await supabaseAdmin
            .from("templates")
            .select("*")
            .eq("id", templateId)
            .single();

        if (templateError || !template) {
            console.error("Template fetch error:", templateError);
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            );
        }
        console.log("Template found:", template.title);

        if (!template.source_url) {
            return NextResponse.json(
                { error: "Template source ZIP not configured" },
                { status: 400 }
            );
        }

        console.log("Step 2: Checking subscription...");

        const cost = template.credit_cost || 20;

        // First: query all valid non-expired active subscriptions
        const now = new Date().toISOString();
        const { data: activeSubs } = await supabaseAdmin
            .from("user_subscriptions")
            .select(`*, plan:subscription_plans(*)`)
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", now)
            .order("created_at", { ascending: false });

        const aggregated = aggregateActiveSubscriptions(activeSubs || []);
        let selectedSubscription: any = null;
        let isExpired = false;

        if (aggregated.hasSubscription && activeSubs && activeSubs.length > 0) {
            const picked = pickSubscriptionForRender(activeSubs, cost);
            selectedSubscription = picked?.subscription || activeSubs[0];

            let activeCost = 0;
            if (aggregated.totalRenderLimit !== null) {
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

            // Check render limit across all aggregated subscriptions
            if (aggregated.totalRenderLimit !== null && (aggregated.totalRendersUsed + activeCost + cost) > aggregated.totalRenderLimit) {
                const available = Math.max(0, (aggregated.totalRendersRemaining || 0) - activeCost);
                return NextResponse.json(
                    { error: `Insufficient credits. This template costs ${cost} credits, but you only have ${available} available (${activeCost > 0 ? `${activeCost} reserved by active renders` : "none in flight"}).` },
                    { status: 403 }
                );
            } else {
                console.log(`Aggregated subscriptions verified. Total credits: ${aggregated.totalRendersUsed}+${activeCost} in-flight/${aggregated.totalRenderLimit || "unlimited"}. Cost: ${cost}. Deducting from sub ${selectedSubscription.id}.`);
            }
        } else {
            // Check for expired subscription with remaining credits
            const { data: expiredSub } = await supabaseAdmin
                .from("user_subscriptions")
                .select(`*, plan:subscription_plans(*)`)
                .eq("user_id", userId)
                .in("status", ["active", "expired", "cancelled"])
                .lt("valid_until", now)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (expiredSub) {
                const expiredPlan = expiredSub.plan as any;
                if (!expiredPlan?.render_limit || (expiredSub.renders_used + cost) <= expiredPlan.render_limit) {
                    selectedSubscription = expiredSub;
                    isExpired = true;
                }
            }

            if (!selectedSubscription) {
                return NextResponse.json(
                    { error: "No active subscription. Please subscribe to render HD videos." },
                    { status: 402 }
                );
            }
        }

        // ── Idempotency guard: prevent duplicate renders on refresh ──────────
        // If the user already has an active (non-terminal) render for the same
        // template + project, return the existing job instead of creating a new one.
        const { data: existingJob } = await supabaseAdmin
            .from("render_jobs")
            .select("id")
            .eq("user_id", userId)
            .eq("template_id", templateId)
            .eq("project_id", projectId || null)
            .eq("is_sample", false)
            .in("status", ["pending", "processing", "queued"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existingJob) {
            console.log(`Idempotency: returning existing active render job ${existingJob.id} instead of creating a duplicate.`);
            return NextResponse.json({
                success: true,
                renderJobId: existingJob.id,
                message: "Render is already in progress"
            });
        }

        // Clean up presigned URLs from parameters before storing them in render_jobs
        const cleanedParameters = { ...parameters };
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

        // Step 3: Create render job record (Processing immediately)
        console.log("Step 3: Creating render job...");
        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert({
                user_id: userId,
                template_id: templateId,
                project_id: projectId || null,
                status: "processing",
                started_at: new Date().toISOString(),
                parameters: cleanedParameters,
                subscription_id: selectedSubscription?.id || null,
                entitlement_id: null,
            })
            .select()
            .single();

        if (jobError || !renderJob) {
            console.error("Render job creation failed:", jobError);
            return NextResponse.json(
                { error: "Failed to create render job", details: jobError?.message || "Unknown error" },
                { status: 500 }
            );
        }
        console.log("Render job created:", renderJob.id);

        // Step 4: Start Plainly render process immediately (non-blocking)
        console.log("Step 4: Starting Plainly render...");
        processRenderJob(renderJob.id).catch((err) => {
            console.error(`Error in background render processing for job ${renderJob.id}:`, err);
        });

        return NextResponse.json({
            success: true,
            renderJobId: renderJob.id,
            message: "Render started successfully"
        });

    } catch (error) {
        console.error("Render request error:", error);
        return NextResponse.json(
            { error: "Failed to create render job" },
            { status: 500 }
        );
    }
}
