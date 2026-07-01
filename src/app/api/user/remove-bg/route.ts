import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin, getOrResetFreeBgRemovals } from "@/lib/supabase-admin";
import { uploadToR2, getPresignedDownloadUrl, getR2KeyFromUrl } from "@/lib/r2";

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
        const nowStr = new Date().toISOString();
        const { data: sub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", nowStr)
            .limit(1)
            .maybeSingle();

        const hasSubscription = !!sub;
        let freeBgRemovalsRemaining = null;

        if (!hasSubscription) {
            const profile = await getOrResetFreeBgRemovals(userId);
            if (!profile) {
                return NextResponse.json({ error: "User profile not found" }, { status: 404 });
            }

            const remaining = profile.free_bg_removals_remaining ?? 3;
            if (remaining <= 0) {
                return NextResponse.json({ 
                    error: "Daily background removal limit reached. Please subscribe to CelitePro for unlimited background removals!",
                    limitReached: true
                }, { status: 403 });
            }
            freeBgRemovalsRemaining = remaining - 1; // Anticipated remaining after this call
        }

        // 1. Generate a secure presigned download URL for R2 so API4AI can read it
        const s3Key = getR2KeyFromUrl(imageUrl);
        const presignedInputUrl = await getPresignedDownloadUrl(s3Key);

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
        formData.append("url", presignedInputUrl);

        console.log(`Sending image to API4AI for background removal... Key: ${s3Key}`);
        const apiResponse = await fetch(api4aiUrl, {
            method: "POST",
            headers: {
                "X-API-KEY": apiKey,
            },
            body: formData,
        });

        if (!apiResponse.ok) {
            const errText = await apiResponse.text();
            console.error("API4AI request failed:", errText);
            return NextResponse.json({ error: "Background removal API failed" }, { status: 502 });
        }

        const data = await apiResponse.json();
        const result = data?.results?.[0];
        
        if (result?.status?.code !== "ok") {
            return NextResponse.json({ 
                error: result?.status?.message || "Failed to remove background from image" 
            }, { status: 422 });
        }

        const imageEntity = result.entities?.find((e: any) => e.kind === "image");
        if (!imageEntity || !imageEntity.image) {
            return NextResponse.json({ error: "No processed image returned from API" }, { status: 502 });
        }

        // 3. Convert base64 result to a Buffer and upload to R2
        const base64String = imageEntity.image;
        const buffer = Buffer.from(base64String, "base64");
        
        const timestamp = Date.now();
        const outputKey = `uploads/user/${userId}/${timestamp}_nobg.png`;
        
        const fileUrl = await uploadToR2(buffer, outputKey, "image/png");
        const presignedGetUrl = await getPresignedDownloadUrl(outputKey);

        // 4. Track in file_assets for cleanup
        if (supabaseAdmin) {
            await supabaseAdmin.from("file_assets").insert({
                user_id: userId,
                file_url: fileUrl,
                file_type: "upload",
                size_bytes: buffer.length,
            });
        }

        // Decrement daily limit for free user
        if (!hasSubscription && supabaseAdmin) {
            await supabaseAdmin
                .from("profiles")
                .update({ free_bg_removals_remaining: freeBgRemovalsRemaining })
                .eq("id", userId);
        }

        return NextResponse.json({
            success: true,
            url: fileUrl,
            presignedGetUrl,
            freeBgRemovalsRemaining,
        });

    } catch (error) {
        console.error("Background removal error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
