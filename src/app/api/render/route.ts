import { NextRequest, NextResponse } from "next/server";
import { plainlyClient } from "@/lib/plainly";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
 * 7. Wait for render completion
 * 8. Upload to R2 and update job
 * 9. Cleanup Plainly project
 */

export async function POST(request: NextRequest) {
    let plainlyProjectId: string | null = null;

    try {
        const body = await request.json();
        const { templateId, userId, parameters } = body;

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

        // Step 2: Create render job record
        const { data: renderJob, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .insert({
                user_id: userId,
                template_id: templateId,
                status: "processing",
                parameters,
            })
            .select()
            .single();

        if (jobError || !renderJob) {
            throw new Error("Failed to create render job");
        }

        // Step 3: Create Plainly project from ZIP
        console.log("Creating Plainly project from:", template.source_url);
        const projectName = `render-${template.slug}-${Date.now()}`;
        const project = await plainlyClient.createProject(
            projectName,
            template.source_url
        );

        // Validate we got a project ID
        if (!project || !project.id) {
            throw new Error("Failed to get project ID from Plainly");
        }

        plainlyProjectId = project.id;
        console.log("Plainly project created with ID:", plainlyProjectId);

        // Store project ID immediately in case of later failure
        await supabaseAdmin
            .from("render_jobs")
            .update({ plainly_project_id: project.id })
            .eq("id", renderJob.id);

        // Step 4: Wait for project to be ready (analysis complete)
        console.log("Waiting for project analysis to complete...");
        await plainlyClient.waitForProject(project.id);
        console.log("Project is ready for rendering");

        // Step 5: Create template with dynamic layers
        console.log("Creating template with placeholders:", {
            images: template.image_placeholders?.map((p: any) => p.key),
            texts: template.text_placeholders?.map((p: any) => p.key)
        });
        const plainlyTemplate = await plainlyClient.createTemplate(
            project.id,
            `template-${template.slug}`,
            template.image_placeholders || [],
            template.text_placeholders || []
        );

        // Step 6: Start render with user parameters
        // Parameters should be keyed by placeholder key (e.g., { img1: "url", text1: "text" })
        const render = await plainlyClient.startRender(
            project.id,
            plainlyTemplate.id,
            parameters || {}
        );

        // Update job with Plainly render ID and project ID (for cleanup)
        await supabaseAdmin
            .from("render_jobs")
            .update({
                plainly_render_id: render.id,
                plainly_project_id: project.id
            })
            .eq("id", renderJob.id);

        // Step 7: Wait for render completion (async in background)
        // For now, return immediately and let client poll for status
        return NextResponse.json({
            success: true,
            renderJobId: renderJob.id,
            plainlyRenderId: render.id,
            status: "processing",
            message: "Render started. Poll /api/render/status for updates.",
        });

    } catch (error) {
        console.error("Render error:", error);

        // Cleanup on error
        if (plainlyProjectId) {
            try {
                await plainlyClient.deleteProject(plainlyProjectId);
            } catch { }
        }

        return NextResponse.json(
            { error: "Render failed", details: String(error) },
            { status: 500 }
        );
    }
}
