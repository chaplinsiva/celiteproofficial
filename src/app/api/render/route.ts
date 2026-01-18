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

        console.log("Render request received:", {
            templateId,
            userId,
            parameters
        });

        if (!templateId || !userId) {
            return NextResponse.json(
                { error: "templateId and userId are required" },
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

        // Step 2: Verify payment exists and is paid
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
            return NextResponse.json(
                { error: "Payment required. Please complete payment before rendering." },
                { status: 402 } // 402 Payment Required
            );
        }

        // Step 3: Check for active renders and calculate queue position
        const { count: activeCount } = await supabaseAdmin
            .from("render_jobs")
            .select("*", { count: "exact", head: true })
            .eq("status", "processing");

        const isQueueEmpty = (activeCount || 0) === 0;
        let queuePosition: number | null = null;

        if (!isQueueEmpty) {
            // Calculate queue position (count of queued + processing jobs)
            const { count: queuedCount } = await supabaseAdmin
                .from("render_jobs")
                .select("*", { count: "exact", head: true })
                .in("status", ["queued", "processing"]);

            queuePosition = (queuedCount || 0) + 1;
        }

        // Create render job record with appropriate status
        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert({
                user_id: userId,
                template_id: templateId,
                status: isQueueEmpty ? "processing" : "queued",
                queue_position: queuePosition,
                started_at: isQueueEmpty ? new Date().toISOString() : null,
                parameters,
            })
            .select()
            .single();

        if (jobError || !renderJob) {
            console.error("Render job creation failed:", jobError);
            console.error("Job data attempted:", {
                user_id: userId,
                template_id: templateId,
                status: isQueueEmpty ? "processing" : "queued",
                queue_position: queuePosition,
                started_at: isQueueEmpty ? new Date().toISOString() : null,
                parameters,
            });
            return NextResponse.json(
                { error: "Failed to create render job", details: jobError?.message || "Unknown error" },
                { status: 500 }
            );
        }

        // Link payment to render job
        await supabaseAdmin
            .from("payments")
            .update({ render_job_id: renderJob.id })
            .eq("id", payment.id);

        // If queued, return immediately without starting render
        if (!isQueueEmpty) {
            return NextResponse.json({
                success: true,
                renderJobId: renderJob.id,
                status: "queued",
                queuePosition,
                message: `In queue - Position ${queuePosition}`,
            });
        }


        // Step 3: Start render processing if not queued
        try {
            const { success } = await processRenderJob(renderJob.id);

            return NextResponse.json({
                success: true,
                renderJobId: renderJob.id,
                status: "processing",
                message: "Render started. Poll /api/render/status for updates.",
            });
        } catch (error) {
            console.error("Render error:", error);
            return NextResponse.json(
                { error: "Render failed", details: String(error) },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error("Render request error:", error);
        return NextResponse.json(
            { error: "Failed to create render job", details: String(error) },
            { status: 500 }
        );
    }
}
