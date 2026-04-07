import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteFromR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * Retention Policy Cron Job Endpoint
 * 
 * Rules Evaluated Here:
 * 1. Free Previews: Deleted 7 days after generation unconditionally.
 * 2. Free Users: All assets deleted 7 days after creation.
 * 3. Expired Subscriptions: If the last active sub expired > 30 days ago, all assets deleted.
 */

export async function GET(request: Request) {
    // Protect this route from public execution
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Fallback or dev override if NO cron secret is defined and it's running locally
        if (process.env.NODE_ENV === "production") {
            return new Response("Unauthorized", { status: 401 });
        }
    }

    try {
        console.log("=== STARTING FILE RETENTION SWEEP ===");
        let deletedCount = 0;

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Sweep Previews globally (>7 days old)
        const { data: expiredPreviews } = await supabaseAdmin
            .from("file_assets")
            .select("*")
            .eq("file_type", "preview")
            .lt("created_at", sevenDaysAgo);

        if (expiredPreviews && expiredPreviews.length > 0) {
            console.log(`Found ${expiredPreviews.length} expired previews...`);
            for (const asset of expiredPreviews) {
                await deleteFileAsset(asset);
                deletedCount++;
            }
        }

        // 2. Identify vulnerable users (Free tier / Expired > 30 days)
        // We fetch ALL users to analyze their subscription states.
        // In highly scaled systems, this is better done via dedicated RPC in SQL.
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();

        if (users?.users) {
            for (const user of users.users) {
                const userId = user.id;

                // Check active sub
                const { data: currentSub } = await supabaseAdmin
                    .from("user_subscriptions")
                    .select("status, valid_until, updated_at")
                    .eq("user_id", userId)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .single();

                let isVulnerableFreeUser = false;
                let isExpiredBeyond30Days = false;

                if (!currentSub) {
                    // No history of sub = free user
                    isVulnerableFreeUser = true;
                } else if (currentSub.status !== "active" && currentSub.status !== "trialing") {
                    // Check if they've been expired 30+ days
                    const inactiveSince = currentSub.updated_at || currentSub.valid_until || "";
                    if (inactiveSince && new Date(inactiveSince) < new Date(thirtyDaysAgo)) {
                         isExpiredBeyond30Days = true;
                    } else if (!currentSub.valid_until) {
                         // edge case cleanup
                         isExpiredBeyond30Days = true; 
                    }
                }

                // Apply policies
                if (isVulnerableFreeUser) {
                    // Delete ALL assets older than 7 days
                    const { data: oldAssets } = await supabaseAdmin
                        .from("file_assets")
                        .select("*")
                        .eq("user_id", userId)
                        .lt("created_at", sevenDaysAgo);

                    if (oldAssets) {
                        for (const asset of oldAssets) {
                            await deleteFileAsset(asset);
                            deletedCount++;
                        }
                    }
                }

                if (isExpiredBeyond30Days) {
                    // Eradicate everything due to abandonment
                    const { data: allAssets } = await supabaseAdmin
                        .from("file_assets")
                        .select("*")
                        .eq("user_id", userId);

                    if (allAssets) {
                        for (const asset of allAssets) {
                            await deleteFileAsset(asset);
                            deletedCount++;
                        }
                    }
                }
            }
        }
        
        // 3. Sweep expired single-pay renders (>90 days)
        const { data: expiredSinglePay } = await supabaseAdmin
            .from("render_jobs")
            .select("*")
            .eq("is_single_pay", true)
            .not("single_pay_expires_at", "is", null)
            .lt("single_pay_expires_at", new Date().toISOString());

        if (expiredSinglePay && expiredSinglePay.length > 0) {
            console.log(`Found ${expiredSinglePay.length} expired single-pay renders...`);
            for (const job of expiredSinglePay) {
                try {
                    // Delete video from R2
                    if (job.output_url && job.output_url.includes("r2.cloudflarestorage.com")) {
                        const url = new URL(job.output_url);
                        const path = url.pathname.substring(1);
                        await deleteFromR2(path);
                    }
                    // Delete render job record
                    await supabaseAdmin.from("render_jobs").delete().eq("id", job.id);
                    deletedCount++;
                } catch (e) {
                    console.error(`Failed to delete single-pay render ${job.id}:`, e);
                }
            }
        }
        
        console.log(`=== FILE RETENTION SWEEP COMPLETE. ${deletedCount} R2 objects deleted ===`);
        return NextResponse.json({ success: true, deletedCount });

    } catch (error) {
        console.error("Cron Sweep Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

async function deleteFileAsset(asset: any) {
    try {
        if (asset.file_url && asset.file_url.includes("r2.cloudflarestorage.com")) {
            const url = new URL(asset.file_url);
            const path = url.pathname.substring(1); // Remove leading slash
            await deleteFromR2(path);
        }

        // Delete from DB tracking table
        await supabaseAdmin.from("file_assets").delete().eq("id", asset.id);
        
    } catch (e) {
        console.error(`Failed to delete asset ${asset.id}:`, e);
    }
}
