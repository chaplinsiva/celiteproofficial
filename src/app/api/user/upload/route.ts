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

        // Check storage limits
        const { data: subscription } = await supabaseAdmin
            .from("user_subscriptions")
            .select("*, plan:subscription_plans(*)")
            .eq("user_id", userId)
            .eq("status", "active")
            .single();

        if (subscription) {
            const plan = subscription.plan as any;
            const currentUsage = subscription.storage_used_bytes || 0;
            const limitBytes = (plan.storage_limit_gb || 0) * 1024 * 1024 * 1024;

            if (currentUsage + file.size > limitBytes) {
                return NextResponse.json({
                    error: "Storage limit reached",
                    details: `You have used ${((currentUsage / limitBytes) * 100).toFixed(1)}% of your storage. Please delete files to upload more.`
                }, { status: 403 });
            }
        } else {
            // Free user limit: 1GB
            const { data: uploadLogs } = await supabaseAdmin
                .from("user_logs")
                .select("data")
                .eq("user_id", userId)
                .eq("action", "upload");

            let storageUsedBytes = 0;
            uploadLogs?.forEach((log: { data: any }) => {
                storageUsedBytes += (log.data as any)?.fileSize || 0;
            });

            const limitBytes = 1 * 1024 * 1024 * 1024; // 1GB
            if (storageUsedBytes + file.size > limitBytes) {
                return NextResponse.json({
                    error: "Storage limit reached",
                    details: `Free tier limit is 1GB. You have used ${((storageUsedBytes / limitBytes) * 100).toFixed(1)}%. Please upgrade for more storage.`
                }, { status: 403 });
            }
        }

        // Upload to R2: /uploads/user/{userId}/{timestamp}_{filename}
        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `uploads/user/${userId}/${timestamp}_${safeName}`;
        const fileUrl = await uploadToR2(buffer, path, file.type);

        // Update storage used in subscription (if exists)
        if (subscription) {
            await supabaseAdmin
                .from("user_subscriptions")
                .update({
                    storage_used_bytes: (subscription.storage_used_bytes || 0) + file.size,
                    updated_at: new Date().toISOString()
                })
                .eq("id", subscription.id);
        }

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
