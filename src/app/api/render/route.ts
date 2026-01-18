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
        const { templateId, userId, parameters } = body;

        console.log("=== RENDER REQUEST START ===");
        console.log("Request body:", { templateId, userId, parametersCount: Object.keys(parameters || {}).length });

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

        console.log("Step 2: Verifying payment...");
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("user_id", userId)
            .eq("template_id", templateId)
            .eq("status", "paid")
            .is("render_job_id", null) // Not yet linked to a render job
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (paymentError || !payment) {
            console.error("Payment verification failed:", paymentError);
            return NextResponse.json(
                { error: "Payment required. Please complete payment before rendering." },
                { status: 402 } // 402 Payment Required
            );
        }
        console.log("Payment verified:", payment.id);

        // Step 3: Create render job record (Processing immediately)
        console.log("Step 3: Creating render job...");
        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert({
                user_id: userId,
                template_id: templateId,
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

        // Step 4: Link payment to render job
        console.log("Step 4: Linking payment...");
        await supabaseAdmin
            .from("payments")
            .update({ render_job_id: renderJob.id })
            .eq("id", payment.id);

        // Step 5: Start Plainly render process immediately (non-blocking)
        console.log("Step 5: Starting Plainly render...");
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
