import { plainlyClient } from "@/lib/plainly";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { uploadToR2 } from "@/lib/r2";

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

        // --- BACKGROUND COMPLETION & CLEANUP ---
        // Wait for render to complete (up to 5 mins)
        console.log(`Waiting for render ${plainlyRender.id} to complete...`);
        const completedRender = await plainlyClient.waitForRender(plainlyRender.id);
        console.log(`Render ${plainlyRender.id} completed with state: ${completedRender.state}`);

        const updateData: any = {
            status: "completed",
            updated_at: new Date().toISOString(),
        };

        // Transfer thumbnails to CDN
        if (completedRender.thumbnailUris && completedRender.thumbnailUris.length > 0) {
            console.log(`Transferring ${completedRender.thumbnailUris.length} thumbnails to CDN...`);
            try {
                const cdnThumbnails = await Promise.all(
                    completedRender.thumbnailUris.map(async (uri, index) => {
                        const res = await fetch(uri);
                        const buffer = Buffer.from(await res.arrayBuffer());
                        const path = `thumbnails/${job.user_id}/${Date.now()}-${index}.jpg`;
                        return await uploadToR2(buffer, path, "image/jpeg");
                    })
                );
                updateData.thumbnail_urls = cdnThumbnails;
            } catch (e) {
                console.error("Failed to transfer thumbnails:", e);
            }
        }

        // Transfer video output to CDN
        if (completedRender.output) {
            console.log("Transferring video output to CDN...");
            try {
                const videoRes = await fetch(completedRender.output);
                const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                const path = `renders/${job.user_id}/${Date.now()}.mp4`;
                const r2Url = await uploadToR2(videoBuffer, path, "video/mp4");
                updateData.output_url = r2Url;
            } catch (e) {
                console.error("Failed to transfer video:", e);
                updateData.output_url = completedRender.output; // Fallback
            }
        }

        // Final DB update
        await supabaseAdmin
            .from("render_jobs")
            .update(updateData)
            .eq("id", renderJobId);

        console.log(`Job ${renderJobId} marked as completed.`);

        // --- SAFE CLEANUP ---
        // We delete the project ONLY if no other active jobs (processing/sampling) are using it.
        // This ensures the project reuse feature doesn't break concurrent renders.
        const { data: activeJobs } = await supabaseAdmin
            .from("render_jobs")
            .select("id")
            .eq("plainly_project_id", plainlyProjectId)
            .in("status", ["processing", "sampling"])
            .neq("id", renderJobId);

        if (!activeJobs || activeJobs.length === 0) {
            console.log(`Safely deleting Plainly project ${plainlyProjectId} (no other active jobs).`);
            try {
                await plainlyClient.deleteProject(plainlyProjectId!);
            } catch (cleanupErr) {
                console.warn("Project cleanup failed:", cleanupErr);
            }
        } else {
            console.log(`Skipping project deletion; ${activeJobs.length} other jobs are still using it.`);
        }

        // Always delete the specific render resource
        try {
            await plainlyClient.deleteRender(plainlyRender.id);
        } catch (cleanupErr) {
            console.warn("Render cleanup failed:", cleanupErr);
        }

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

        throw error;
    }
}
