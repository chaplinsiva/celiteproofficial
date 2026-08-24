// agent-notes: { ctx: "Subscription credit aggregation and gift stacking logic across active plans", deps: [], state: active, last: "sato@2026-08-24" }

export interface PlanData {
    id: string;
    name: string;
    billing_cycle: string;
    price_monthly: number;
    render_limit: number | null;
    storage_limit_gb: number;
}

export interface SubscriptionData {
    id: string;
    user_id: string;
    status: string;
    autopay_status: string;
    renders_used: number;
    valid_from: string;
    valid_until: string;
    created_at: string;
    plan: PlanData;
}

export interface AggregatedSubscriptionResult {
    hasSubscription: boolean;
    hasPaidSubscription: boolean;
    isWelcomeGiftOnly: boolean;
    hasUnlimitedPreviews: boolean;
    primarySubscription: SubscriptionData | null;
    primaryPlan: PlanData | null;
    totalRenderLimit: number | null;
    totalRendersUsed: number;
    totalRendersRemaining: number | null;
    maxStorageLimitGb: number;
    hasGiftCredits: boolean;
    giftCreditsRemaining: number;
    activeSubscriptionIds: string[];
}

/**
 * Aggregates all active non-expired user subscriptions.
 * Prioritizes paid subscription for plan identity and storage limit,
 * and sums up credits across all active plans (e.g. Paid Subscription + Welcome Gift).
 */
export function aggregateActiveSubscriptions(
    activeSubs: SubscriptionData[]
): AggregatedSubscriptionResult {
    if (!activeSubs || activeSubs.length === 0) {
        return {
            hasSubscription: false,
            hasPaidSubscription: false,
            isWelcomeGiftOnly: false,
            hasUnlimitedPreviews: false,
            primarySubscription: null,
            primaryPlan: null,
            totalRenderLimit: 0,
            totalRendersUsed: 0,
            totalRendersRemaining: 0,
            maxStorageLimitGb: 1,
            hasGiftCredits: false,
            giftCreditsRemaining: 0,
            activeSubscriptionIds: []
        };
    }

    const hasPaidSubscription = activeSubs.some(s => (s.plan?.price_monthly || 0) > 0 && s.plan?.name !== "Welcome Gift");
    const isWelcomeGiftOnly = activeSubs.length > 0 && !hasPaidSubscription;
    const hasUnlimitedPreviews = hasPaidSubscription;

    // Sort to prioritize paid subscriptions over free gifts for primary plan representation
    const sortedSubs = [...activeSubs].sort((a, b) => {
        const priceA = a.plan?.price_monthly || 0;
        const priceB = b.plan?.price_monthly || 0;
        if (priceB !== priceA) return priceB - priceA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const primarySub = sortedSubs[0];
    const primaryPlan = primarySub.plan;

    let totalLimit: number | null = 0;
    let totalUsed = 0;
    let totalRemaining: number | null = 0;
    let maxStorage = 1;
    let hasGift = false;
    let giftRemaining = 0;

    for (const sub of activeSubs) {
        const plan = sub.plan;
        if (!plan) continue;

        if (plan.storage_limit_gb > maxStorage) {
            maxStorage = plan.storage_limit_gb;
        }

        const isGift = plan.name === "Welcome Gift" || plan.price_monthly === 0;
        const limit = plan.render_limit;
        const used = sub.renders_used || 0;
        totalUsed += used;

        if (limit === null) {
            totalLimit = null;
            totalRemaining = null;
        } else {
            if (totalLimit !== null) {
                totalLimit += limit;
            }
            const rem = Math.max(0, limit - used);
            if (totalRemaining !== null) {
                totalRemaining += rem;
            }
            if (isGift) {
                hasGift = true;
                giftRemaining += rem;
            }
        }
    }

    return {
        hasSubscription: true,
        hasPaidSubscription,
        isWelcomeGiftOnly,
        hasUnlimitedPreviews,
        primarySubscription: primarySub,
        primaryPlan: primaryPlan,
        totalRenderLimit: totalLimit,
        totalRendersUsed: totalUsed,
        totalRendersRemaining: totalRemaining,
        maxStorageLimitGb: maxStorage,
        hasGiftCredits: hasGift,
        giftCreditsRemaining: giftRemaining,
        activeSubscriptionIds: activeSubs.map(s => s.id)
    };
}

/**
 * Selects the optimal subscription record from which to deduct render credits.
 * Prefers paid subscription with available credits; falls back to gift subscription.
 */
export function pickSubscriptionForRender(
    activeSubs: SubscriptionData[],
    cost: number
): { subscription: SubscriptionData; deductionSource: "primary" | "gift" } | null {
    if (!activeSubs || activeSubs.length === 0) return null;

    // Prefer primary paid subscription if it has enough credits
    const paidSubs = activeSubs.filter(s => (s.plan?.price_monthly || 0) > 0 && s.plan?.name !== "Welcome Gift");
    for (const sub of paidSubs) {
        const limit = sub.plan.render_limit;
        if (limit === null || (sub.renders_used + cost) <= limit) {
            return { subscription: sub, deductionSource: "primary" };
        }
    }

    // Otherwise check gift subscriptions
    const giftSubs = activeSubs.filter(s => s.plan?.name === "Welcome Gift" || (s.plan?.price_monthly || 0) === 0);
    for (const sub of giftSubs) {
        const limit = sub.plan.render_limit;
        if (limit === null || (sub.renders_used + cost) <= limit) {
            return { subscription: sub, deductionSource: "gift" };
        }
    }

    // Fallback to first active sub
    return { subscription: activeSubs[0], deductionSource: "primary" };
}
