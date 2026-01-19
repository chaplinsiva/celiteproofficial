import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const slug = formData.get("slug") as string;

        if (!slug) {
            return NextResponse.json({ error: "Slug is required" }, { status: 400 });
        }

        const results: Record<string, string> = {};

        // Upload preview video
        const preview = formData.get("preview") as File | null;
        if (preview) {
            const buffer = Buffer.from(await preview.arrayBuffer());
            const ext = preview.name.split(".").pop() || "mp4";
            const path = `templates/${slug}/preview.${ext}`;
            results.preview_url = await uploadToR2(buffer, path, preview.type);
        }

        // Upload thumbnail
        const thumbnail = formData.get("thumbnail") as File | null;
        if (thumbnail) {
            const buffer = Buffer.from(await thumbnail.arrayBuffer());
            const ext = thumbnail.name.split(".").pop() || "jpg";
            const path = `templates/${slug}/thumbnail.${ext}`;
            results.thumbnail_url = await uploadToR2(buffer, path, thumbnail.type);
        }

        // Upload source ZIP
        const source = formData.get("source") as File | null;
        if (source) {
            const buffer = Buffer.from(await source.arrayBuffer());
            const path = `templates/${slug}/source.zip`;
            results.source_url = await uploadToR2(buffer, path, "application/zip");
        }

        // Upload reference image for placeholder
        const reference = formData.get("reference") as File | null;
        const key = formData.get("key") as string | null;
        if (reference && key) {
            const buffer = Buffer.from(await reference.arrayBuffer());
            const ext = reference.name.split(".").pop() || "jpg";
            const path = `templates/${slug}/references/${key}.${ext}`;
            results.reference_url = await uploadToR2(buffer, path, reference.type);
        }

        return NextResponse.json({ success: true, urls: results });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Upload failed", details: String(error) },
            { status: 500 }
        );
    }
}
