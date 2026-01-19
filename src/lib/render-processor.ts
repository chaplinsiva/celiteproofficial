import { plainlyClient } from "@/lib/plainly";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Shared render processing logic
 * Can be called from both the initial POST request and queue progression
 */
export async function processRenderJob(renderJobId: string, isSample: boolean = false) {
    let plainlyProjectId: string | null = null;
    const MAX_RETRIES = 3;

    try {
        // Get render job and template data
        const { data: job, error: jobError } = await supabaseAdmin
            .from("render_jobs")
            .select("*, templates(*)")
            .eq("id", renderJobId)
            .single();

        if (jobError || !job) {
            throw new Error("Render job not found");
        }

        const template = job.templates;
        if (!template || !template.source_url) {
            throw new Error("Template source ZIP not configured");
        }

        // Update status to processing or sampling
        await supabaseAdmin
            .from("render_jobs")
            .update({ status: isSample ? "sampling" : "processing" })
            .eq("id", renderJobId);

        // --- PROJECT MANAGEMENT (REUSE OR CREATE) ---
        // Search for an existing project for this template
        // We use a naming convention: render-[slug]
        const projectBaseName = `render-${template.slug}`;
        console.log(`Checking for existing project: ${projectBaseName}`);

        let projectToUse: any = null;

        try {
            const existingProjects = await plainlyClient.getProjects();
            // Find the most recent READY project for this template
            projectToUse = existingProjects
                .filter(p => p.name.startsWith(projectBaseName) && (p.status === "RENDER_READY" || (p as any).renderReady))
                .sort((a, b) => b.id.localeCompare(a.id))[0]; // Use latest if multiple exist
        } catch (e) {
            console.warn("Failed to check for existing projects, will attempt to create new one:", e);
        }

        if (projectToUse) {
            console.log("Reusing existing Plainly project:", projectToUse.id);
            plainlyProjectId = projectToUse.id;
        } else {
            console.log("No ready project found. Creating new Plainly project...");
            // Retry loop for project creation
            for (let i = 0; i < MAX_RETRIES; i++) {
                try {
                    const projectName = `${projectBaseName}-${Date.now()}`;
                    const project = await plainlyClient.createProject(
                        projectName,
                        template.source_url
                    );
                    plainlyProjectId = project.id;
                    break;
                } catch (e) {
                    console.error(`Project creation attempt ${i + 1} failed:`, e);
                    if (i === MAX_RETRIES - 1) throw e;
                    // Exponential backoff: 2s, 4s, 8s
                    await new Promise(r => setTimeout(r, Math.pow(2, i + 1) * 1000));
                }
            }
        }

        if (!plainlyProjectId) {
            throw new Error("Failed to get project ID");
        }

        // Store project ID
        await supabaseAdmin
            .from("render_jobs")
            .update({ plainly_project_id: plainlyProjectId })
            .eq("id", renderJobId);

        // Wait for project analysis (if newly created)
        console.log("Verifying project is ready...");
        await plainlyClient.waitForProject(plainlyProjectId);
        console.log("Project is ready for rendering");

        // Create template with dynamic layers
        // We ALWAYS create a fresh template for the project to ensure layer bindings are correct
        const plainlyTemplate = await plainlyClient.createTemplate(
            plainlyProjectId,
            `template-${template.slug}-${Date.now()}`,
            template.image_placeholders || [],
            template.text_placeholders || []
        );

        // Prepare render options
        let renderOptions: any = {};
        if (isSample) {
            renderOptions = {
                thumbnails: {
                    atSeconds: [0],
                    format: "JPG",
                    fromEncodedVideo: true
                },
                outputFormatSettings: {
                    settingsTemplate: "DRAFT",
                    postEncodingType: "None"
                }
            };
        }

        const parameters = job.parameters || {};
        console.log("Starting render with parameters:", JSON.stringify(parameters));

        const plainlyRender = await plainlyClient.startRender(
            plainlyProjectId,
            isSample ? null : plainlyTemplate.id,
            parameters as Record<string, string>,
            renderOptions
        );

        // Update job with Plainly render ID
        await supabaseAdmin
            .from("render_jobs")
            .update({
                plainly_render_id: plainlyRender.id,
                plainly_project_id: plainlyProjectId,
            })
            .eq("id", renderJobId);

        console.log(`${isSample ? "Sample" : "Full"} render started successfully for job ${renderJobId}`);
        return { success: true, renderId: plainlyRender.id };

    } catch (error) {
        console.error(`Render processing error for job ${renderJobId}:`, error);

        await supabaseAdmin
            .from("render_jobs")
            .update({
                status: "failed",
                error_message: String(error),
            })
            .eq("id", renderJobId);

        // Only delete project if we just created it and it failed. 
        // For now, we'll avoid deleting to allow reuse of correctly created projects.

        throw error;
    }
}
