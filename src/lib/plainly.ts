/**
 * Plainly Videos API Client
 * 
 * Layer Structure Convention:
 * - Main render comp: "render"
 * - Image layers: img1 comp contains img1 layer (nested)
 * - Text layers: text1, text2, etc. directly in render comp
 */

const PLAINLY_API_KEY = process.env.PLAINLY_API_KEY!;
const PLAINLY_BASE_URL = "https://api.plainlyvideos.com/api/v2";

interface PlainlyProject {
    id: string;
    name: string;
    status: string;
}

interface PlainlyTemplate {
    id: string;
    name: string;
    projectId: string;
}

interface PlainlyRender {
    id: string;
    state: string;
    output?: string;
}

interface CompositionInfo {
    id: string;
    internalId: string;
    name: string;
    type: string;
    children?: MetaItem[];
}

interface MetaItem {
    id: string;
    internalId: string;
    name: string;
    type: string;  // "COMPOSITION", "MEDIA", "TEXT"
    mediaType?: string;  // "IMAGE", "VIDEO", "AUDIO", "SOLID"
    children?: MetaItem[];
}

class PlainlyClient {
    private authHeader: string;

    constructor() {
        // Plainly uses Basic Auth: API_KEY as username, empty password
        const basicAuth = Buffer.from(`${PLAINLY_API_KEY}:`).toString("base64");
        this.authHeader = `Basic ${basicAuth}`;
    }

    // Headers for JSON API calls
    private get headers(): HeadersInit {
        return {
            "Authorization": this.authHeader,
            "Content-Type": "application/json",
        };
    }

    /**
     * Create a project from a ZIP file URL
     * Plainly requires multipart/form-data, not JSON
     */
    async createProject(name: string, zipUrl: string): Promise<PlainlyProject> {
        // Use FormData for multipart/form-data
        const formData = new FormData();
        formData.append("name", name);
        formData.append("fileUrl", zipUrl);

        const res = await fetch(`${PLAINLY_BASE_URL}/projects`, {
            method: "POST",
            headers: {
                "Authorization": this.authHeader,
                // Don't set Content-Type - fetch will set it with boundary for FormData
            },
            body: formData,
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to create project: ${error}`);
        }

        return res.json();
    }

    /**
     * Get project details and wait for it to be ready
     */
    async waitForProject(projectId: string, maxWait = 180000): Promise<PlainlyProject> {
        const start = Date.now();
        let attempt = 0;

        while (Date.now() - start < maxWait) {
            attempt++;
            const res = await fetch(`${PLAINLY_BASE_URL}/projects/${projectId}`, {
                headers: this.headers,
            });

            if (!res.ok) {
                const error = await res.text();
                throw new Error(`Failed to get project: ${error}`);
            }

            const project = await res.json();

            console.log(`Project check attempt ${attempt}:`, {
                id: project.id,
                status: project.status,
                analysisInfo: project.analysis,
                renderReady: project.renderReady
            });

            // Check multiple possible ready states
            if (project.status === "RENDER_READY" ||
                project.renderReady === true ||
                project.analysis?.done === true) {
                console.log("Project is ready for rendering!");
                return project;
            }

            // Check for failure states
            if (project.status === "FAILED" || project.analysis?.failed === true) {
                throw new Error(`Project analysis failed: ${project.errorMessage || project.analysis?.error || "Unknown error"}`);
            }

            // Wait 3 seconds before checking again
            await new Promise((r) => setTimeout(r, 3000));
        }

        throw new Error(`Project did not become ready in time (waited ${maxWait / 1000}s)`);
    }

    /**
     * Get project metadata (flattened for easier parsing)
     */
    async getProjectMetadata(projectId: string): Promise<MetaItem[]> {
        const res = await fetch(`${PLAINLY_BASE_URL}/projects/${projectId}/meta?responseType=flatten`, {
            headers: this.headers,
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to get metadata: ${error}`);
        }

        const data = await res.json();
        return data || [];
    }

    /**
     * Create a manual template with dynamic layers
     * 
     * Structure:
     * - render comp → img1 comp → img1 layer (for images)
     * - render comp → text1 layer (for text)
     */
    async createTemplate(
        projectId: string,
        templateName: string,
        imagePlaceholders: { key: string }[],
        textPlaceholders: { key: string }[]
    ): Promise<PlainlyTemplate> {
        // Get flattened metadata
        const metadata = await this.getProjectMetadata(projectId);

        console.log("Project metadata items:", metadata.map(m => ({ name: m.name, type: m.type, internalId: m.internalId })));

        // Find the main render composition
        let renderComp = metadata.find(
            (m) => m.type === "COMPOSITION" && m.name.toLowerCase() === "render"
        );

        if (!renderComp) {
            // Try to find any composition that could be the main render comp
            renderComp = metadata.find((m) => m.type === "COMPOSITION");
            if (!renderComp) {
                throw new Error("No compositions found in project");
            }
            console.log("Using fallback composition:", renderComp.name);
        }

        // Get both the name and ID (convert ID to number for Plainly API)
        const renderingComposition = renderComp.name;
        const renderingCompositionId = parseInt(renderComp.internalId, 10);

        console.log("Render composition:", { name: renderingComposition, id: renderingCompositionId });

        // Build LAYERS array (not parameters!) - this is what Plainly expects
        const layers: any[] = [];

        // Add image layers
        for (const img of imagePlaceholders) {
            // Find layer with matching name that is MEDIA type
            const imgLayer = metadata.find(
                (m) => m.type === "MEDIA" && m.name.toLowerCase() === img.key.toLowerCase()
            );

            if (imgLayer) {
                console.log(`Found image layer: ${imgLayer.name} (internalId: ${imgLayer.internalId})`);

                // Find the composition this layer belongs to
                // The img1 layer should be inside img1 composition
                const parentComp = metadata.find(
                    (m) => m.type === "COMPOSITION" && m.name.toLowerCase() === img.key.toLowerCase()
                );

                const layerIdNum = parseInt(imgLayer.internalId, 10);

                layers.push({
                    internalId: layerIdNum,
                    layerName: imgLayer.name,
                    layerType: "MEDIA",
                    mediaType: "image",
                    label: img.key,
                    parametrization: {
                        expression: true,
                        value: `#${img.key}`,  // Parameter key with # prefix
                        type: "mediaAutoScale",
                        scaleToFit: true,
                        forceFill: false,
                        scaleToComposition: true,
                        fixedRatio: true,
                    },
                    compositions: parentComp ? [{
                        name: parentComp.name,
                        id: parseInt(parentComp.internalId, 10),
                    }] : [{
                        name: renderingComposition,
                        id: renderingCompositionId,
                    }],
                    scripts: [{
                        name: "Media auto scale",
                        type: "mediaAutoScale",
                        options: {
                            fill: false,
                            fixedRatio: true,
                        }
                    }],
                });
            } else {
                console.warn(`Image layer not found: ${img.key}`);
            }
        }

        // Add text layers
        for (const txt of textPlaceholders) {
            const textLayer = metadata.find(
                (m) => m.type === "TEXT" && m.name.toLowerCase() === txt.key.toLowerCase()
            );

            if (textLayer) {
                console.log(`Found text layer: ${textLayer.name} (internalId: ${textLayer.internalId})`);
                const layerIdNum = parseInt(textLayer.internalId, 10);

                layers.push({
                    internalId: layerIdNum,
                    layerName: textLayer.name,
                    layerType: "TEXT",
                    label: txt.key,
                    parametrization: {
                        expression: true,
                        value: `#${txt.key}`,
                        type: "text",
                    },
                    compositions: [{
                        name: renderingComposition,
                        id: renderingCompositionId,
                    }],
                });
            } else {
                console.warn(`Text layer not found: ${txt.key}`);
            }
        }

        console.log("Creating template with layers:", JSON.stringify(layers, null, 2));

        const requestBody = {
            name: templateName,
            renderingComposition: renderingComposition,
            renderingCompositionId: renderingCompositionId,
            layers,  // Use 'layers' not 'parameters'
        };

        console.log("Template creation request:", JSON.stringify(requestBody, null, 2));

        const res = await fetch(`${PLAINLY_BASE_URL}/projects/${projectId}/templates`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to create template: ${error}`);
        }

        const response = await res.json();

        // Log full response to debug
        console.log("Template creation response:", JSON.stringify(response, null, 2));

        // IMPORTANT: response.id is the PROJECT ID, not template ID!
        // The actual template ID is in templates[0].id or defaultTemplateId
        const templateId =
            response.templates?.[0]?.id ||  // First check templates array
            response.defaultTemplateId ||    // Then check defaultTemplateId
            response.templateId;             // Last resort

        // Validate we got a real template ID (not the project ID)
        if (!templateId) {
            console.error("Template response has no template ID:", response);
            throw new Error("Template created but no template ID returned");
        }

        // Sanity check: template ID should NOT equal project ID
        if (templateId === response.id) {
            console.warn("⚠️ WARNING: templateId equals response.id - this might be wrong!");
        }

        console.log("✅ Template created with ID:", templateId);
        console.log("   (Project ID was:", response.id, ")");

        return {
            id: templateId,
            name: response.templates?.[0]?.name || response.name || templateName,
            projectId,
        };
    }

    /**
     * Start a render job
     */
    async startRender(
        projectId: string,
        templateId: string,
        parameters: Record<string, string>
    ): Promise<PlainlyRender> {
        // Plainly expects parameters as an object { key: value }, not an array
        const requestBody = {
            projectId,
            templateId,
            parameters, // Direct object: { img1: "url", text1: "text" }
        };

        console.log("Starting render with:", JSON.stringify(requestBody, null, 2));

        const res = await fetch(`${PLAINLY_BASE_URL}/renders`, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`Failed to start render: ${error}`);
        }

        return res.json();
    }

    /**
     * Check render status
     */
    async getRenderStatus(renderId: string): Promise<PlainlyRender> {
        const res = await fetch(`${PLAINLY_BASE_URL}/renders/${renderId}`, {
            headers: this.headers,
        });

        if (!res.ok) throw new Error("Failed to get render status");

        return res.json();
    }

    /**
     * Wait for render to complete
     */
    async waitForRender(renderId: string, maxWait = 300000): Promise<PlainlyRender> {
        const start = Date.now();

        while (Date.now() - start < maxWait) {
            const render = await this.getRenderStatus(renderId);

            if (render.state === "DONE") {
                return render;
            }

            if (render.state === "FAILED") {
                throw new Error("Render failed");
            }

            await new Promise((r) => setTimeout(r, 3000));
        }

        throw new Error("Render did not complete in time");
    }

    /**
     * Delete a project (cleanup)
     */
    async deleteProject(projectId: string): Promise<void> {
        await fetch(`${PLAINLY_BASE_URL}/projects/${projectId}`, {
            method: "DELETE",
            headers: this.headers,
        });
    }
}

export const plainlyClient = new PlainlyClient();
export type { PlainlyProject, PlainlyTemplate, PlainlyRender, CompositionInfo };
