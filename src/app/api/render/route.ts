import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { processRenderJob } from "@/lib/render-processor";


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

        // First: try a valid non-expired active subscription
        const now = new Date().toISOString();
        const { data: activeSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select(`*, plan:subscription_plans(*)`)
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", now)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        // Second: if no active sub, check for expired subscription with remaining credits
        let subscription: any = activeSub;
        let isExpired = false;

        if (!activeSub) {
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
                const cost = template.credit_cost || 20;
                // Only allow if credits remain
                if (!expiredPlan.render_limit || (expiredSub.renders_used + cost) <= expiredPlan.render_limit) {
                    subscription = expiredSub;
                    isExpired = true;
                }
            }
        }

        const cost = template.credit_cost || 20;

        // ── Case 2: Check for one-time render entitlement ───────────────────
        const { data: activeEntitlement } = await supabaseAdmin
            .from("user_template_entitlements")
            .select("*")
            .eq("user_id", userId)
            .eq("template_id", templateId)
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        let entitlement: any = null;
        let entitlementActiveCost = 0;

        if (activeEntitlement) {
            // Concurrency guard for entitlement renders
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
            const { data: entitlementActiveJobs } = await supabaseAdmin
                .from("render_jobs")
                .select("template_id, templates(credit_cost)")
                .eq("user_id", userId)
                .eq("template_id", templateId)
                .eq("is_sample", false)
                .in("status", ["pending", "processing", "queued"])
                .gte("created_at", fifteenMinutesAgo);

            entitlementActiveCost = entitlementActiveJobs?.reduce(
                (sum: number, j: any) => sum + (j.templates?.credit_cost || 20), 0
            ) || 0;

            if (activeEntitlement.credits_remaining >= cost + entitlementActiveCost) {
                entitlement = activeEntitlement;
                console.log(`Entitlement ${entitlement.id} found for template ${templateId}. Credits: ${entitlement.credits_remaining}, in-flight: ${entitlementActiveCost}, cost: ${cost}.`);
            }
        }

        // ── Subscription concurrency guard (only when using subscription) ───
        if (subscription) {
            const plan = subscription.plan as any;

            let activeCost = 0;
            if (plan.render_limit) {
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

            // Check render limit (for non-expired subs — expired already checked above)
            if (!isExpired && plan.render_limit && (subscription.renders_used + activeCost + cost) > plan.render_limit) {
                // Subscription exhausted — fall back to entitlement if available
                if (entitlement) {
                    console.log(`[route.ts] Subscription exhausted. Falling back to entitlement ${entitlement.id} for template ${templateId}.`);
                    subscription = null; // Clear subscription to use entitlement path
                } else {
                    const available = Math.max(0, plan.render_limit - subscription.renders_used - activeCost);
                    return NextResponse.json(
                        { error: `Insufficient credits. This template costs ${cost} credits, but you only have ${available} available (${activeCost > 0 ? `${activeCost} reserved by active renders` : "none in flight"}).` },
                        { status: 403 }
                    );
                }
            } else {
                console.log(`Subscription verified (expired: ${isExpired}). Credits: ${subscription.renders_used}+${activeCost} in-flight/${plan.render_limit || "unlimited"}. Cost: ${cost}. Credit deducted only on success.`);
            }
        }

        // ── Case 3: Neither subscription nor entitlement ────────────────────
        if (!subscription && !entitlement) {
            if (activeEntitlement) {
                const available = Math.max(0, activeEntitlement.credits_remaining - entitlementActiveCost);
                return NextResponse.json(
                    { error: `Insufficient entitlement credits. This template costs ${cost} credits, but you only have ${available} available.` },
                    { status: 403 }
                );
            }
            return NextResponse.json(
                { error: "No active subscription or one-time render entitlement. Please subscribe or purchase a one-time render." },
                { status: 402 }
            );
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
                // Store authorization reference so processor can deduct credits on success
                subscription_id: subscription?.id || null,
                entitlement_id: entitlement?.id || null,
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
