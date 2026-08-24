// agent-notes: { ctx: "Admin upload path generator for template assets", deps: [], state: active, last: "sato@2026-08-24" }

/**
 * Generates an R2 storage path for an admin template asset with timestamping
 * to prevent CDN/browser cache stale issues when replacing thumbnails or files.
 */
export function getAdminUploadPath(
    slug: string,
    key: string,
    filename: string,
    timestamp: number = Date.now()
): string {
    const ext = filename.split(".").pop() || "";

    if (key === "preview") {
        return `templates/${slug}/preview_${timestamp}.${ext}`;
    }
    if (key === "thumbnail") {
        return `templates/${slug}/thumbnail_${timestamp}.${ext}`;
    }
    if (key === "source") {
        return `templates/${slug}/source_${timestamp}.zip`;
    }
    if (key.startsWith("reference_")) {
        const refKey = key.replace("reference_", "");
        return `templates/${slug}/references/${refKey}_${timestamp}.${ext}`;
    }

    return `templates/${slug}/${key}_${timestamp}.${ext}`;
}
