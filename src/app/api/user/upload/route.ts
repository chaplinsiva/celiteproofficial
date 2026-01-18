import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const userId = formData.get("userId") as string;
        const templateId = formData.get("templateId") as string;
        const placeholderKey = formData.get("placeholderKey") as string;

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Upload to R2: /uploads/user/{userId}/{timestamp}_{filename}
        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `uploads/user/${userId}/${timestamp}_${safeName}`;
        const fileUrl = await uploadToR2(buffer, path, file.type);

        // Log the upload in database
        await supabaseAdmin.from("user_logs").insert({
            user_id: userId,
            template_id: templateId || null,
            action: "upload",
            data: {
                placeholderKey,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
            },
            file_urls: [fileUrl],
        });

        return NextResponse.json({ success: true, url: fileUrl });
    } catch (error) {
        console.error("User upload error:", error);
        return NextResponse.json(
            { error: "Upload failed", details: String(error) },
            { status: 500 }
        );
    }
}
