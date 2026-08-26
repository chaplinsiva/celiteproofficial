// agent-notes: { ctx: "API route for subscription status with multi-subscription credit aggregation", deps: ["src/lib/supabase-admin.ts", "src/lib/subscription-credits.ts"], state: active, last: "sato@2026-08-24" }
import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getOrResetFreePreviews, getOrResetFreeBgRemovals, getAuthenticatedUser } from "@/lib/supabase-admin";
import { aggregateActiveSubscriptions } from "@/lib/subscription-credits";
import { DEFAULT_FREE_PREVIEWS_LIMIT, calculateFreePreviewsStatus } from "@/lib/free-previews";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/status
 * Returns current user's subscription status and aggregated render credits
 */
export async function GET(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        // Get all active non-expired subscriptions for the user
        const now = new Date().toISOString();
        const { data: activeSubs, error } = await supabaseAdmin
            .from("user_subscriptions")
            .select(`*, plan:subscription_plans(*)`)
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", now)
            .order("created_at", { ascending: false });

        const aggregated = aggregateActiveSubscriptions(activeSubs || []);

        // Calculate storage usage dynamically from file_assets tracking table
        const { data: userFiles } = await supabaseAdmin
            .from("file_assets")
            .select("size_bytes")
            .eq("user_id", userId);

        let storageUsedBytes = 0;
        userFiles?.forEach((file: { size_bytes: number }) => {
            storageUsedBytes += file.size_bytes || 0;
        });

        // If no active subscription, check for expired one with remaining credits
        let expiredCredits: { remaining: number; planName: string } | null = null;
        if (error || !aggregated.hasSubscription) {
            const { data: expiredSub } = await supabaseAdmin
                .from("user_subscriptions")
                .select(`renders_used, plan:subscription_plans(name, render_limit)`)
                .eq("user_id", userId)
                .in("status", ["active", "expired", "cancelled"])
                .lt("valid_until", now)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (expiredSub) {
                const p = expiredSub.plan as any;
                const isUnlimited = !p?.render_limit;
                const remaining = isUnlimited ? null : Math.max(0, p.render_limit - expiredSub.renders_used);
                if (isUnlimited || (remaining !== null && remaining > 0)) {
                    expiredCredits = {
                        remaining: remaining ?? 9999,
                        planName: p?.name || "Previous Plan",
                        isUnlimited,
                    } as any;
                }
            }
        }

        // Fetch active one-time render entitlements
        const { data: activeEntitlements } = await supabaseAdmin
            .from("user_template_entitlements")
            .select("id, template_id, credits_remaining, status, created_at")
            .eq("user_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: true });

        const templateEntitlements = (activeEntitlements || []).map((e: any) => ({
            id: e.id,
            templateId: e.template_id,
            creditsRemaining: e.credits_remaining,
            status: e.status,
        }));
        const hasEntitlement = templateEntitlements.length > 0;

        if (error || !aggregated.hasSubscription) {
            // Free user tier
            const profile = await getOrResetFreePreviews(userId);
            const previewStatus = calculateFreePreviewsStatus(profile?.free_previews_remaining, DEFAULT_FREE_PREVIEWS_LIMIT);
            const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024);
            const storageLimitGb = 1;
            const storagePercent = (storageUsedGb / storageLimitGb) * 100;

            const bgProfile = await getOrResetFreeBgRemovals(userId);
            const freeBgRemovalsRemaining = bgProfile?.free_bg_removals_remaining ?? 3;

            return NextResponse.json({
                hasSubscription: false,
                hasPaidSubscription: false,
                hasUnlimitedPreviews: false,
                isFreeUser: true,
                isExpired: false,
                freeBgRemovalsRemaining,
                hasExpiredCredits: !!expiredCredits,
                expiredCredits,
                hasEntitlement,
                templateEntitlements,
                message: expiredCredits
                    ? `Your subscription expired. You have ${expiredCredits.remaining ?? "unlimited"} credits remaining — renders stored under free plan (1GB, 3-day retention).`
                    : "Free tier: 1GB storage. Projects & renders deleted after 3 days.",
                subscription: {
                    storageUsedBytes,
                    storageUsedGb: storageUsedGb.toFixed(2),
                    storagePercent: storagePercent.toFixed(1),
                    previewsUsed: previewStatus.previewsUsed,
                    previewLimit: previewStatus.previewLimit,
                    previewPercent: previewStatus.previewPercent,
                },
                plan: {
                    name: "Free",
                    storageLimitGb,
                    renderLimit: 0,
                },
                warnings: {
                    storageNearLimit: storagePercent >= 90,
                    storageAtLimit: storagePercent >= 100,
                    rendersExhausted: false,
                    autopayIssue: false,
                    subscriptionExpired: !!expiredCredits,
                    previewsNearLimit: previewStatus.previewsNearLimit,
                    previewsExhausted: previewStatus.previewsExhausted,
                },
            });
        }

        const primarySub = aggregated.primarySubscription!;
        const plan = aggregated.primaryPlan!;
        const storageLimitGb = aggregated.maxStorageLimitGb;
        const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024);
        const storagePercent = (storageUsedGb / storageLimitGb) * 100;
        const rendersRemaining = aggregated.totalRendersRemaining;
        const isPaidSubscriber = aggregated.hasPaidSubscription;

        let previewsUsed: number | null = null;
        let previewLimit: number | null = null;
        let previewPercent = "0";
        let previewsExhausted = false;
        let previewsNearLimit = false;
        let freeBgRemovalsRemaining: number | null = null;

        // If user is not a paid subscriber (e.g. only has Welcome Gift), enforce free preview & BG removal limits
        if (!isPaidSubscriber) {
            const profile = await getOrResetFreePreviews(userId);
            const previewStatus = calculateFreePreviewsStatus(profile?.free_previews_remaining, DEFAULT_FREE_PREVIEWS_LIMIT);
            previewsUsed = previewStatus.previewsUsed;
            previewLimit = previewStatus.previewLimit;
            previewPercent = previewStatus.previewPercent;
            previewsNearLimit = previewStatus.previewsNearLimit;
            previewsExhausted = previewStatus.previewsExhausted;

            const bgProfile = await getOrResetFreeBgRemovals(userId);
            freeBgRemovalsRemaining = bgProfile?.free_bg_removals_remaining ?? 3;
        }

        return NextResponse.json({
            hasSubscription: true,
            hasPaidSubscription: isPaidSubscriber,
            isWelcomeGiftOnly: aggregated.isWelcomeGiftOnly,
            hasUnlimitedPreviews: aggregated.hasUnlimitedPreviews,
            isFreeUser: !isPaidSubscriber,
            isExpired: false,
            hasExpiredCredits: false,
            expiredCredits: null,
            hasEntitlement,
            templateEntitlements,
            hasGiftCredits: aggregated.hasGiftCredits,
            giftCreditsRemaining: aggregated.giftCreditsRemaining,
            freeBgRemovalsRemaining,
            subscription: {
                id: primarySub.id,
                status: primarySub.status,
                autopayStatus: primarySub.autopay_status,
                validFrom: primarySub.valid_from,
                validUntil: primarySub.valid_until,
                rendersUsed: aggregated.totalRendersUsed,
                rendersRemaining,
                storageUsedBytes,
                storageUsedGb: storageUsedGb.toFixed(2),
                storagePercent: storagePercent.toFixed(1),
                previewsUsed,
                previewLimit,
                previewPercent,
            },
            plan: {
                id: plan.id,
                name: plan.name,
                billingCycle: plan.billing_cycle,
                renderLimit: aggregated.totalRenderLimit,
                storageLimitGb,
            },
            warnings: {
                storageNearLimit: storagePercent >= 90,
                storageAtLimit: storagePercent >= 100,
                rendersExhausted: aggregated.totalRenderLimit !== null && aggregated.totalRendersUsed >= aggregated.totalRenderLimit,
                autopayIssue: primarySub.autopay_status !== "active",
                subscriptionExpired: false,
                previewsNearLimit,
                previewsExhausted,
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
