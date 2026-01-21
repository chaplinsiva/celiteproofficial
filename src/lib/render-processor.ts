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

        // --- PROJECT CREATION (ALWAYS SEPARATE) ---
        console.log(`Creating fresh Plainly project for job ${renderJobId}...`);
        const projectBaseName = `render-${template.slug}`;

        // Retry loop for project creation
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const projectName = `${projectBaseName}-${renderJobId}-${Date.now()}`;
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

        if (!plainlyProjectId) {
            throw new Error("Failed to get project ID");
        }

        // Store project ID
        await supabaseAdmin
            .from("render_jobs")
            .update({ plainly_project_id: plainlyProjectId })
            .eq("id", renderJobId);

        // Wait for project analysis
        console.log("Verifying project is ready...");
        await plainlyClient.waitForProject(plainlyProjectId);
        console.log("Project is ready for rendering");

        // Create template with dynamic layers
        const plainlyTemplate = await plainlyClient.createTemplate(
            plainlyProjectId,
            `template-${template.slug}-${Date.now()}`,
            template.image_placeholders || [],
            template.text_placeholders || []
        );

        // Prepare render options for free preview (low quality 480p)
        let renderOptions: any = {};
        if (isSample) {
            renderOptions = {
                thumbnails: {
                    atSeconds: [0],
                    format: "JPG",
                    fromEncodedVideo: true
                },
                outputFormat: {
                    // Plainly free preview/low quality parameter: 'DRAFT' settings template
                    // Combined with 'Scale' post-encoding at 25% for quarter quality
                    settingsTemplate: "DRAFT",
                    postEncoding: {
                        type: "scale",
                        scalingPercentage: 25
                    }
                }
            };
        }

        const parameters = job.parameters || {};
        console.log("Starting render with parameters:", JSON.stringify(parameters));

        const plainlyRender = await plainlyClient.startRender(
            plainlyProjectId,
            plainlyTemplate.id, // Always use template ID to ensure parametrization is applied
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
        // For sample renders with watermark, use the watermarked output
        const videoOutputUrl = isSample && completedRender.outputWatermark
            ? completedRender.outputWatermark
            : completedRender.output;

        if (videoOutputUrl) {
            console.log(`Transferring video output to CDN (${isSample ? 'watermarked preview' : 'full render'})...`);
            try {
                const videoRes = await fetch(videoOutputUrl);
                const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
                const path = `renders/${job.user_id}/${Date.now()}.mp4`;
                const r2Url = await uploadToR2(videoBuffer, path, "video/mp4");
                updateData.output_url = r2Url;
            } catch (e) {
                console.error("Failed to transfer video:", e);
                updateData.output_url = videoOutputUrl; // Fallback
            }
        }

        // Final DB update
        await supabaseAdmin
            .from("render_jobs")
            .update(updateData)
            .eq("id", renderJobId);

        console.log(`Job ${renderJobId} marked as completed.`);

        // --- CLEANUP ---
        // Always delete since we no longer reuse projects
        console.log(`Deleting Plainly project ${plainlyProjectId} for job ${renderJobId}`);
        try {
            await plainlyClient.deleteProject(plainlyProjectId);
        } catch (cleanupErr) {
            console.warn("Project cleanup failed:", cleanupErr);
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

        if (plainlyProjectId) {
            try {
                await plainlyClient.deleteProject(plainlyProjectId);
            } catch { }
        }

        throw error;
    }
}
