import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin, getOrResetFreeBgRemovals } from "@/lib/supabase-admin";
import { uploadToR2, getPresignedDownloadUrl, getR2KeyFromUrl, r2Client, BUCKET_NAME } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const authResult = await getAuthenticatedUser(request);
        if (authResult instanceof Response) return authResult;
        const { userId } = authResult;

        const body = await request.json();
        const { imageUrl, mode } = body;

        if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
        }

        // Check user subscription status
        let hasSubscription = false;
        let freeBgRemovalsRemaining: number | null = null;

        if (supabaseAdmin) {
            const nowStr = new Date().toISOString();
            const { data: sub } = await supabaseAdmin
                .from("user_subscriptions")
                .select("id")
                .eq("user_id", userId)
                .eq("status", "active")
                .gte("valid_until", nowStr)
                .limit(1)
                .maybeSingle();

            hasSubscription = !!sub;

            if (!hasSubscription) {
                const profile = await getOrResetFreeBgRemovals(userId);
                const remaining = profile?.free_bg_removals_remaining ?? 3;
                if (remaining <= 0) {
                    return NextResponse.json({ 
                        error: "Daily background removal limit reached. Please subscribe to CelitePro for unlimited background removals!",
                        limitReached: true
                    }, { status: 403 });
                }
                freeBgRemovalsRemaining = remaining - 1; // Anticipated remaining after this call
            }
        }

        // 1. Retrieve the image buffer directly for reliable processing
        let imageBuffer: Buffer | null = null;

        if (imageUrl.startsWith("data:")) {
            const base64Data = imageUrl.split(",")[1];
            if (base64Data) {
                imageBuffer = Buffer.from(base64Data, "base64");
            }
        } else {
            // Try fetching from R2 directly via S3 client
            const s3Key = getR2KeyFromUrl(imageUrl);
            if (s3Key) {
                try {
                    const getCmd = new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: s3Key,
                    });
                    const r2Res = await r2Client.send(getCmd);
                    if (r2Res.Body) {
                        const byteArray = await r2Res.Body.transformToByteArray();
                        imageBuffer = Buffer.from(byteArray);
                    }
                } catch (r2Err) {
                    console.warn(`Direct R2 fetch for key "${s3Key}" failed:`, r2Err);
                }
            }

            // Fallback: If not found in R2 directly or imageUrl is an external HTTP URL
            if (!imageBuffer && imageUrl.startsWith("http")) {
                try {
                    let fetchUrl = imageUrl;
                    if (imageUrl.includes("r2.cloudflarestorage.com") || imageUrl.includes("files.celitepro.in")) {
                        try {
                            fetchUrl = await getPresignedDownloadUrl(s3Key);
                        } catch {}
                    }
                    const httpRes = await fetch(fetchUrl);
                    if (httpRes.ok) {
                        const arrayBuffer = await httpRes.arrayBuffer();
                        imageBuffer = Buffer.from(arrayBuffer);
                    }
                } catch (httpErr) {
                    console.warn("HTTP image fetch fallback failed:", httpErr);
                }
            }
        }

        // 2. Call API4AI background removal endpoint
        const apiKey = process.env.BG_REMOVER_API;
        const baseUrl = (process.env.BG_REMOVER_URL || "https://api4ai.cloud/img-bg-removal/v1").trim().replace(/\/$/, "");
        
        if (!apiKey) {
            console.error("BG_REMOVER_API environment variable is not defined");
            return NextResponse.json({ error: "Background removal service is not configured (missing API key)" }, { status: 500 });
        }
        
        const isPeople = mode === "people";
        const api4aiUrl = isPeople ? `${baseUrl}/people/results` : `${baseUrl}/results`;

        const formData = new FormData();

        if (imageBuffer) {
            formData.append("image", new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }), "input_image.png");
        } else {
            // Fallback to sending presigned URL if buffer couldn't be loaded
            const s3Key = getR2KeyFromUrl(imageUrl);
            const presignedInputUrl = await getPresignedDownloadUrl(s3Key);
            formData.append("url", presignedInputUrl);
        }

        console.log(`Sending image to API4AI (${mode || "general"})... Endpoint: ${api4aiUrl}`);
        const apiResponse = await fetch(api4aiUrl, {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
            },
            body: formData,
        });

        if (!apiResponse.ok) {
            const errText = await apiResponse.text();
            console.error("API4AI request failed with HTTP " + apiResponse.status + ":", errText);
            return NextResponse.json({ error: `Background removal API failed: ${errText || apiResponse.statusText}` }, { status: 502 });
        }

        const data = await apiResponse.json();
        const result = data?.results?.[0];
        
        const statusCode = result?.status?.code?.toLowerCase();
        if (statusCode && statusCode !== "ok" && statusCode !== "success") {
            return NextResponse.json({ 
                error: result?.status?.message || "Failed to remove background from image" 
            }, { status: 422 });
        }

        // Extract base64 image from entities
        const entities = result?.entities || [];
        const imageEntity = entities.find((e: any) => e.image || e.kind === "image" || e.format?.includes("image")) || entities[0];
        const base64String = imageEntity?.image;

        if (!base64String) {
            console.error("API4AI response missing image. Full response:", JSON.stringify(data));
            return NextResponse.json({ error: "No processed image returned from background removal service" }, { status: 502 });
        }

        // 3. Convert base64 result to a Buffer and upload to R2
        const buffer = Buffer.from(base64String, "base64");
        const timestamp = Date.now();
        const outputKey = `uploads/user/${userId}/${timestamp}_nobg.png`;
        
        const fileUrl = await uploadToR2(buffer, outputKey, "image/png");
        const presignedGetUrl = await getPresignedDownloadUrl(outputKey);

        // 4. Track in file_assets for cleanup
        if (supabaseAdmin) {
            try {
                await supabaseAdmin.from("file_assets").insert({
                    user_id: userId,
                    file_url: fileUrl,
                    file_type: "upload",
                    size_bytes: buffer.length,
                });
            } catch (assetErr) {
                console.warn("Failed to insert file_asset:", assetErr);
            }
        }

        // 5. Decrement daily limit for free user
        if (!hasSubscription && supabaseAdmin && freeBgRemovalsRemaining !== null) {
            try {
                await supabaseAdmin
                    .from("profiles")
                    .update({ free_bg_removals_remaining: freeBgRemovalsRemaining })
                    .eq("id", userId);
            } catch (profErr) {
                console.warn("Failed to update profile free_bg_removals_remaining:", profErr);
            }
        }

        return NextResponse.json({
            success: true,
            url: fileUrl,
            presignedGetUrl,
            freeBgRemovalsRemaining,
        });

    } catch (error: any) {
        console.error("Background removal error:", error);
        return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
    }
}
