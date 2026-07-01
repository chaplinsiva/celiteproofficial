import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { verifyAdminRequest } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        const body = await request.json();
        const { slug, files } = body;

        if (!slug) {
            return NextResponse.json({ error: "Slug is required" }, { status: 400 });
        }

        const results: Record<string, { presignedUrl: string; publicUrl: string }> = {};

        for (const [key, fileObj] of Object.entries(files)) {
            const typedFileObj = fileObj as { name: string; type: string };
            const ext = typedFileObj.name.split(".").pop() || "";
            let path = "";

            if (key === "preview") path = `templates/${slug}/preview.${ext}`;
            else if (key === "thumbnail") path = `templates/${slug}/thumbnail.${ext}`;
            else if (key === "source") path = `templates/${slug}/source.zip`;
            else if (key.startsWith("reference_")) path = `templates/${slug}/references/${key.replace("reference_", "")}.${ext}`;
            else continue;

            const presignedUrl = await getPresignedUploadUrl(path, typedFileObj.type);
            const publicUrl = getPublicUrl(path);

            results[key] = { presignedUrl, publicUrl };
        }

        return NextResponse.json({ success: true, urls: results });
    } catch (error) {
        console.error("Presign upload error:", error);
        return NextResponse.json(
            { error: "Presign generation failed", details: String(error) },
            { status: 500 }
        );
    }
}
