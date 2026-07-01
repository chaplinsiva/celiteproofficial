import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getOrResetFreePreviews, getOrResetFreeBgRemovals, getAuthenticatedUser } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/status
 * Returns current user's subscription status
 */
export async function GET(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {

        // Get subscription — first try active non-expired
        const now = new Date().toISOString();
        const { data: subscription, error } = await supabaseAdmin
            .from("user_subscriptions")
            .select(`*, plan:subscription_plans(*)`)
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", now)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        // Calculate storage usage dynamically from file_assets tracking table for 100% accuracy (reflects deletions)
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
        if (error || !subscription) {
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
                // Only show expired credits if plan was unlimited OR some credits remain
                if (isUnlimited || (remaining !== null && remaining > 0)) {
                    expiredCredits = {
                        remaining: remaining ?? 9999, // 9999 = sentinel for unlimited
                        planName: p?.name || "Previous Plan",
                        isUnlimited,
                    } as any;
                }
            }
        }

        // ── Fetch active one-time render entitlements ────────────────────
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

        if (error || !subscription) {
            // Get or reset free previews dynamically from profiles
            const profile = await getOrResetFreePreviews(userId);
            const remaining = profile?.free_previews_remaining ?? 10;
            const previewsUsed = Math.max(0, 10 - remaining);
            const previewLimit = 10;
            const previewPercent = (previewsUsed / previewLimit) * 100;
            const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024);
            const storageLimitGb = 1;
            const storagePercent = (storageUsedGb / storageLimitGb) * 100;

            // Get or reset free background removals
            const bgProfile = await getOrResetFreeBgRemovals(userId);
            const freeBgRemovalsRemaining = bgProfile?.free_bg_removals_remaining ?? 3;

            return NextResponse.json({
                hasSubscription: false,
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
                },
            });
        }

        const plan = subscription.plan as any;
        const storageUsedGb = storageUsedBytes / (1024 * 1024 * 1024);
        const storagePercent = (storageUsedGb / plan.storage_limit_gb) * 100;
        const rendersRemaining = plan.render_limit ? plan.render_limit - subscription.renders_used : null;

        return NextResponse.json({
            hasSubscription: true,
            isFreeUser: false,
            isExpired: false,
            hasExpiredCredits: false,
            expiredCredits: null,
            hasEntitlement,
            templateEntitlements,
            subscription: {
                id: subscription.id,
                status: subscription.status,
                autopayStatus: subscription.autopay_status,
                validFrom: subscription.valid_from,
                validUntil: subscription.valid_until,
                rendersUsed: subscription.renders_used,
                rendersRemaining,
                storageUsedBytes,
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
                subscriptionExpired: false,
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
