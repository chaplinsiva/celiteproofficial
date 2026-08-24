// agent-notes: { ctx: "Admin upload presigned URL generator", deps: ["src/lib/r2.ts", "src/lib/supabase-admin.ts", "src/lib/admin-upload.ts"], state: active, last: "sato@2026-08-24" }
import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { verifyAdminRequest } from "@/lib/supabase-admin";
import { getAdminUploadPath } from "@/lib/admin-upload";

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
        const timestamp = Date.now();

        for (const [key, fileObj] of Object.entries(files)) {
            const typedFileObj = fileObj as { name: string; type: string };
            const path = getAdminUploadPath(slug, key, typedFileObj.name, timestamp);

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
