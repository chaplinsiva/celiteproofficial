import { plainlyClient } from "@/lib/plainly";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Shared render processing logic
 * Can be called from both the initial POST request and queue progression
 */
export async function processRenderJob(renderJobId: string, isSample: boolean = false) {
    let plainlyProjectId: string | null = null;

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

        // Create Plainly project from ZIP
        console.log(`Creating Plainly project (${isSample ? "SAMPLE" : "FULL"}) from:`, template.source_url);
        const projectName = `render-${template.slug}-${Date.now()}`;
        const project = await plainlyClient.createProject(
            projectName,
            template.source_url
        );

        if (!project || !project.id) {
            throw new Error("Failed to get project ID from Plainly");
        }

        plainlyProjectId = project.id;
        console.log("Plainly project created with ID:", plainlyProjectId);

        // Store project ID
        await supabaseAdmin
            .from("render_jobs")
            .update({ plainly_project_id: project.id })
            .eq("id", renderJobId);

        // Wait for project analysis
        console.log("Waiting for project analysis to complete...");
        await plainlyClient.waitForProject(project.id);
        console.log("Project is ready for rendering");

        // Create template with dynamic layers
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

        // Prepare render options
        let renderOptions: any = {};
        if (isSample) {
            renderOptions = {
                thumbnails: {
                    atSeconds: [0], // One thumbnail for the dashboard
                    format: "JPG",
                    fromEncodedVideo: true
                },
                outputFormatSettings: {
                    settingsTemplate: "DRAFT",
                    postEncodingType: "None"
                }
            };
            console.log("Free Preview render options (DRAFT):", JSON.stringify(renderOptions));
        }

        const parameters = job.parameters || {};
        console.log("Starting render with parameters:", JSON.stringify(parameters));

        const plainlyRender = await plainlyClient.startRender(
            project.id,
            isSample ? null : plainlyTemplate.id, // Omit templateId for samples to test project-level render if that's what user meant
            parameters as Record<string, string>,
            renderOptions
        );

        // Update job with Plainly render ID and Project ID for cleanup
        await supabaseAdmin
            .from("render_jobs")
            .update({
                plainly_render_id: plainlyRender.id,
                plainly_project_id: project.id,
            })
            .eq("id", renderJobId);

        console.log(`${isSample ? "Sample" : "Full"} render started successfully for job ${renderJobId}`);
        return { success: true, renderId: plainlyRender.id };

    } catch (error) {
        console.error(`Render processing error for job ${renderJobId}:`, error);

        // Update job status to failed
        await supabaseAdmin
            .from("render_jobs")
            .update({
                status: "failed",
                error_message: String(error),
            })
            .eq("id", renderJobId);

        // Cleanup on error
        if (plainlyProjectId) {
            try {
                await plainlyClient.deleteProject(plainlyProjectId);
            } catch { }
        }

        throw error;
    }
}
