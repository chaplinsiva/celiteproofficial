import { NextRequest, NextResponse } from "next/server";
import { plainlyClient } from "@/lib/plainly";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
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
    let plainlyProjectId: string | null = null;

    try {
        const body = await request.json();
        const { templateId, userId, parameters, projectId } = body;

        console.log("=== RENDER REQUEST START ===");
        console.log("Request body:", { templateId, userId, projectId, parametersCount: Object.keys(parameters || {}).length });

        if (!templateId || !userId) {
            return NextResponse.json(
                { error: "templateId and userId are required" },
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

        // Get active subscription
        const { data: subscription, error: subError } = await supabaseAdmin
            .from("user_subscriptions")
            .select(`
                *,
                plan:subscription_plans(*)
            `)
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (subError || !subscription) {
            console.error("No active subscription:", subError);
            return NextResponse.json(
                { error: "No active subscription. Please subscribe to render videos." },
                { status: 402 }
            );
        }

        const plan = subscription.plan as any;

        // Check render limit (null means unlimited)
        if (plan.render_limit && subscription.renders_used >= plan.render_limit) {
            return NextResponse.json(
                { error: `Render limit reached (${subscription.renders_used}/${plan.render_limit}). Wait for renewal or upgrade your plan.` },
                { status: 403 }
            );
        }

        // Increment renders_used
        const { error: updateError } = await supabaseAdmin
            .from("user_subscriptions")
            .update({
                renders_used: subscription.renders_used + 1,
                updated_at: new Date().toISOString()
            })
            .eq("id", subscription.id);

        if (updateError) {
            console.error("Failed to update render count:", updateError);
        }

        console.log(`Subscription verified. Renders used: ${subscription.renders_used + 1}/${plan.render_limit || "unlimited"}`);

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
                parameters,
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
            { error: "Failed to create render job", details: String(error) },
            { status: 500 }
        );
    }
}
