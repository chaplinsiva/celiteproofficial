import { NextRequest, NextResponse } from "next/server";
import { plainlyClient } from "@/lib/plainly";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
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
        const body = await request.json();
        const { templateId, userId, parameters } = body;

        console.log("=== SAMPLE RENDER REQUEST START ===");
        console.log("Request body:", { templateId, userId });

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

        // Step 2: Create render job record (Sampling)
        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert({
                user_id: userId,
                template_id: templateId,
                status: "sampling",
                started_at: new Date().toISOString(),
                parameters: {
                    ...(parameters || {}), // Ensure parameters is an object, handle null/undefined
                },
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
            { error: "Failed to create sample render job", details: String(error) },
            { status: 500 }
        );
    }
}
