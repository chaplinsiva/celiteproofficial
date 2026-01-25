import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/status
 * Returns current user's subscription status
 */
export async function GET(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const userId = request.nextUrl.searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 }
            );
        }

        // Get active subscription with plan details
        const { data: subscription, error } = await supabaseAdmin
            .from("user_subscriptions")
            .select(`
                *,
                plan:subscription_plans(*)
            `)
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error || !subscription) {
            // No active subscription - free user with 1GB limit
            // We need to fetch current storage usage from user_logs for free users
            const { data: uploads } = await supabaseAdmin
                .from("user_logs")
                .select("data")
                .eq("user_id", userId)
                .eq("action", "upload");

            let storageUsedBytes = 0;
            uploads?.forEach((u: { data: any }) => {
                const size = (u.data as any)?.fileSize || 0;
                storageUsedBytes += size;
            });

            // Fetch free preview count from user_logs
            const { data: previews } = await supabaseAdmin
                .from("user_logs")
                .select("id")
                .eq("user_id", userId)
                .eq("action", "free_preview");

            const previewsUsed = previews?.length || 0;
            const previewLimit = 10;
            const previewPercent = (previewsUsed / previewLimit) * 100;

            const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024);
            const storageLimitGb = 1; // 1GB for free users
            const storagePercent = (storageUsedGb / storageLimitGb) * 100;

            return NextResponse.json({
                hasSubscription: false,
                isFreeUser: true,
                message: "Free tier: 1GB storage. Projects & renders deleted after 3 days.",
                subscription: {
                    storageUsedBytes,
                    storageUsedGb: storageUsedGb.toFixed(2),
                    storagePercent: storagePercent.toFixed(1),
                    previewsUsed,
                    previewLimit,
                    previewPercent: previewPercent.toFixed(1),
                },
                plan: {
                    name: "Free",
                    storageLimitGb,
                    renderLimit: 0,
                },
                warnings: {
                    storageNearLimit: storagePercent >= 90,
                    storageAtLimit: storagePercent >= 100,
                    previewsNearLimit: previewPercent >= 80,
                    previewsExhausted: previewPercent >= 100,
                }
            });
        }

        const plan = subscription.plan as any;
        const storageUsedGb = subscription.storage_used_bytes / (1024 * 1024 * 1024);
        const storagePercent = (storageUsedGb / plan.storage_limit_gb) * 100;
        const rendersRemaining = plan.render_limit ? plan.render_limit - subscription.renders_used : null;

        return NextResponse.json({
            hasSubscription: true,
            isFreeUser: false,
            subscription: {
                id: subscription.id,
                status: subscription.status,
                autopayStatus: subscription.autopay_status,
                validFrom: subscription.valid_from,
                validUntil: subscription.valid_until,
                rendersUsed: subscription.renders_used,
                rendersRemaining,
                storageUsedBytes: subscription.storage_used_bytes,
                storageUsedGb: storageUsedGb.toFixed(2),
                storagePercent: storagePercent.toFixed(1),
                previewsUsed: null,
                previewLimit: null,
                previewPercent: 0,
            },
            plan: {
                id: plan.id,
                name: plan.name,
                billingCycle: plan.billing_cycle,
                renderLimit: plan.render_limit,
                storageLimitGb: plan.storage_limit_gb,
            },
            warnings: {
                storageNearLimit: storagePercent >= 90,
                storageAtLimit: storagePercent >= 100,
                rendersExhausted: plan.render_limit && subscription.renders_used >= plan.render_limit,
                autopayIssue: subscription.autopay_status !== "active",
            },
        });

    } catch (error) {
        console.error("Subscription status error:", error);
        return NextResponse.json(
            { error: "Failed to fetch subscription status" },
            { status: 500 }
        );
    }
}
