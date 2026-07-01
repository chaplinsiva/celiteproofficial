import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteFromR2 } from "@/lib/r2";
import { sendRetentionWarningEmail } from "@/lib/mailer";

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
    // Protect this cron endpoint from public execution
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error("CRON_SECRET environment variable is not set");
        return new Response("Server misconfiguration", { status: 500 });
    }
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return new Response("Unauthorized", { status: 401 });
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
                    .maybeSingle();

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

                    // Check if we need to send a warning email for assets that will be deleted soon
                    // Assets created between 5 and 7 days ago.
                    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
                    const { data: warningAssets } = await supabaseAdmin
                        .from("file_assets")
                        .select("id, created_at")
                        .eq("user_id", userId)
                        .lt("created_at", fiveDaysAgo)
                        .gt("created_at", sevenDaysAgo);

                    if (warningAssets && warningAssets.length > 0) {
                        const { data: recentWarning } = await supabaseAdmin
                            .from("user_logs")
                            .select("id")
                            .eq("user_id", userId)
                            .eq("action", "retention_warning_sent")
                            .gt("created_at", fiveDaysAgo)
                            .maybeSingle();

                        if (!recentWarning && user.email) {
                            // Find the minimum days remaining for any asset in that list
                            let minDaysRemaining = 2;
                            for (const asset of warningAssets) {
                                const ageMs = Date.now() - new Date(asset.created_at).getTime();
                                const daysLeft = Math.max(1, Math.ceil(7 - (ageMs / (24 * 60 * 60 * 1000))));
                                if (daysLeft < minDaysRemaining) {
                                    minDaysRemaining = daysLeft;
                                }
                            }

                            console.log(`[Retention] Sending warning to free user ${user.email} (${minDaysRemaining} days remaining)`);
                            await sendRetentionWarningEmail(user.email, minDaysRemaining);

                            await supabaseAdmin.from("user_logs").insert({
                                user_id: userId,
                                action: "retention_warning_sent",
                                data: {
                                    type: "free_tier",
                                    daysRemaining: minDaysRemaining,
                                    assetCount: warningAssets.length
                                }
                            });
                        }
                    }
                }

                // Check warning for expired subscription
                if (!isVulnerableFreeUser && !isExpiredBeyond30Days && currentSub) {
                    const inactiveSince = currentSub.updated_at || currentSub.valid_until || "";
                    if (inactiveSince) {
                        const inactiveDate = new Date(inactiveSince);
                        const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
                        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

                        if (inactiveDate < twentyEightDaysAgo && inactiveDate > thirtyDaysAgo) {
                            const expiredDurationMs = Date.now() - inactiveDate.getTime();
                            const expiredDaysRemaining = Math.max(1, Math.ceil(30 - (expiredDurationMs / (24 * 60 * 60 * 1000))));

                            // Only warn if they actually have assets
                            const { data: userAssets } = await supabaseAdmin
                                .from("file_assets")
                                .select("id")
                                .eq("user_id", userId)
                                .limit(1);

                            if (userAssets && userAssets.length > 0) {
                                const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
                                const { data: recentWarning } = await supabaseAdmin
                                    .from("user_logs")
                                    .select("id")
                                    .eq("user_id", userId)
                                    .eq("action", "retention_warning_sent")
                                    .gt("created_at", fiveDaysAgo)
                                    .maybeSingle();

                                if (!recentWarning && user.email) {
                                    console.log(`[Retention] Sending warning to expired user ${user.email} (${expiredDaysRemaining} days remaining)`);
                                    await sendRetentionWarningEmail(user.email, expiredDaysRemaining);

                                    await supabaseAdmin.from("user_logs").insert({
                                        user_id: userId,
                                        action: "retention_warning_sent",
                                        data: {
                                            type: "expired_subscription",
                                            daysRemaining: expiredDaysRemaining,
                                            inactiveSince
                                        }
                                    });
                                }
                            }
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
        return NextResponse.json({ error: "Retention sweep failed" }, { status: 500 });
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
