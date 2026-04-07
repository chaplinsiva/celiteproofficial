import { NextRequest, NextResponse } from "next/server";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/r2";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "Server configuration error: missing Supabase service key" }, { status: 500 });
        }

        const body = await request.json();
        const { userId, templateId, placeholderKey, fileName, fileType, fileSize } = body;

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        if (!fileName || !fileType) {
            return NextResponse.json({ error: "File metadata (fileName, fileType) is required" }, { status: 400 });
        }

        const fileSizeBytes = fileSize || 0;


        // Check storage limits
        const { data: subscription } = await supabaseAdmin
            .from("user_subscriptions")
            .select("*, plan:subscription_plans(*)")
            .eq("user_id", userId)
            .eq("status", "active")
            .single();

        let storageLimitGb = 0.5; // Free tier DEFAULT = 500MB (=0.5GB)
        let currentUsage = 0;

        if (subscription) {
            const plan = subscription.plan as any;
            currentUsage = subscription.storage_used_bytes || 0;
            storageLimitGb = plan.storage_limit_gb || 0;
        } else {
            // Free user limit: 500MB
            // Calculate usage from new file_assets tracking table (faster & safer than logs)
            const { data: userFiles } = await supabaseAdmin
                .from("file_assets")
                .select("size_bytes")
                .eq("user_id", userId);

            userFiles?.forEach((file: { size_bytes: number }) => {
                currentUsage += file.size_bytes || 0;
            });
        }

        const limitBytes = storageLimitGb * 1024 * 1024 * 1024;
        
        if (currentUsage + fileSizeBytes > limitBytes) {
            return NextResponse.json({
                error: "Storage limit reached",
                details: `You have used ${((currentUsage / limitBytes) * 100).toFixed(1)}% of your storage capacity (${storageLimitGb}GB limit). Please delete files to upload more.`
            }, { status: 403 });
        }

        // Generate presigned URL for direct browser-to-R2 upload
        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
        const path = `uploads/user/${userId}/${timestamp}_${safeName}`;

        const presignedUrl = await getPresignedUploadUrl(path, fileType);
        const fileUrl = getPublicUrl(path);

        // Update storage used in subscription (if exists)
        if (subscription) {
            await supabaseAdmin
                .from("user_subscriptions")
                .update({
                    storage_used_bytes: currentUsage + fileSizeBytes,
                    updated_at: new Date().toISOString()
                })
                .eq("id", subscription.id);
        }

        // Track in NEW `file_assets` Table for deterministic cleanup
        await supabaseAdmin.from("file_assets").insert({
            user_id: userId,
            file_url: fileUrl,
            file_type: "upload",
            size_bytes: fileSizeBytes,
        });

        // Optional legacy log
        await supabaseAdmin.from("user_logs").insert({
            user_id: userId,
            template_id: templateId || null,
            action: "upload",
            data: {
                placeholderKey,
                fileName,
                fileType,
                fileSize: fileSizeBytes,
            },
            file_urls: [fileUrl],
        });

        return NextResponse.json({ success: true, presignedUrl, url: fileUrl });
    } catch (error) {
        console.error("User upload error:", error);
        return NextResponse.json(
            { error: "Upload failed", details: String(error) },
            { status: 500 }
        );
    }
}
