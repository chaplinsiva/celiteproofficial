// agent-notes: { ctx: "Unit tests for multi-subscription credit aggregation and welcome gift stacking", deps: [], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";

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

export function aggregateActiveSubscriptions(
    activeSubs: SubscriptionData[]
): AggregatedSubscriptionResult {
    if (!activeSubs || activeSubs.length === 0) {
        return {
            hasSubscription: false,
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

export function pickSubscriptionForRender(
    activeSubs: SubscriptionData[],
    cost: number
): { subscription: SubscriptionData; deductionSource: "primary" | "gift" } | null {
    if (!activeSubs || activeSubs.length === 0) return null;

    // Prefer primary paid subscription if it has enough credits
    const paidSubs = activeSubs.filter(s => s.plan?.price_monthly > 0);
    for (const sub of paidSubs) {
        const limit = sub.plan.render_limit;
        if (limit === null || (sub.renders_used + cost) <= limit) {
            return { subscription: sub, deductionSource: "primary" };
        }
    }

    // Otherwise check gift subscriptions
    const giftSubs = activeSubs.filter(s => s.plan?.name === "Welcome Gift" || s.plan?.price_monthly === 0);
    for (const sub of giftSubs) {
        const limit = sub.plan.render_limit;
        if (limit === null || (sub.renders_used + cost) <= limit) {
            return { subscription: sub, deductionSource: "gift" };
        }
    }

    // Fallback to first active sub
    return { subscription: activeSubs[0], deductionSource: "primary" };
}

describe("Subscription Credit Aggregation & Welcome Gift Stacking", () => {
    const welcomePlan: PlanData = {
        id: "plan-gift",
        name: "Welcome Gift",
        billing_cycle: "monthly",
        price_monthly: 0,
        render_limit: 10,
        storage_limit_gb: 1
    };

    const monthlyOfferPlan: PlanData = {
        id: "plan-offer",
        name: "Monthly Offer",
        billing_cycle: "monthly",
        price_monthly: 49900,
        render_limit: 40,
        storage_limit_gb: 5
    };

    const creatorPlan: PlanData = {
        id: "plan-creator",
        name: "Creator",
        billing_cycle: "monthly",
        price_monthly: 159900,
        render_limit: 120,
        storage_limit_gb: 50
    };

    it("should aggregate 10 welcome gift credits with 40 monthly offer credits to give 50 total credits", () => {
        const activeSubs: SubscriptionData[] = [
            {
                id: "sub-gift-1",
                user_id: "user-1",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-24T00:00:00Z",
                valid_until: "2026-09-24T00:00:00Z",
                created_at: "2026-08-24T00:00:00Z",
                plan: welcomePlan
            },
            {
                id: "sub-paid-1",
                user_id: "user-1",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-24T01:00:00Z",
                valid_until: "2026-09-24T01:00:00Z",
                created_at: "2026-08-24T01:00:00Z",
                plan: monthlyOfferPlan
            }
        ];

        const aggregated = aggregateActiveSubscriptions(activeSubs);

        assert.equal(aggregated.hasSubscription, true);
        assert.equal(aggregated.primaryPlan?.name, "Monthly Offer");
        assert.equal(aggregated.maxStorageLimitGb, 5);
        assert.equal(aggregated.totalRenderLimit, 50); // 40 + 10
        assert.equal(aggregated.totalRendersRemaining, 50); // 40 + 10
        assert.equal(aggregated.hasGiftCredits, true);
        assert.equal(aggregated.giftCreditsRemaining, 10);
    });

    it("should retain paid plan as primary when welcome gift is claimed afterwards", () => {
        const activeSubs: SubscriptionData[] = [
            {
                id: "sub-paid-1",
                user_id: "user-2",
                status: "active",
                autopay_status: "active",
                renders_used: 10,
                valid_from: "2026-08-24T00:00:00Z",
                valid_until: "2026-09-24T00:00:00Z",
                created_at: "2026-08-24T00:00:00Z",
                plan: creatorPlan // 120 credits, 10 used = 110 remaining
            },
            {
                id: "sub-gift-1",
                user_id: "user-2",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-24T02:00:00Z",
                valid_until: "2026-09-24T02:00:00Z",
                created_at: "2026-08-24T02:00:00Z", // Claimed later
                plan: welcomePlan // 10 credits, 0 used = 10 remaining
            }
        ];

        const aggregated = aggregateActiveSubscriptions(activeSubs);

        assert.equal(aggregated.primaryPlan?.name, "Creator");
        assert.equal(aggregated.maxStorageLimitGb, 50);
        assert.equal(aggregated.totalRenderLimit, 130); // 120 + 10
        assert.equal(aggregated.totalRendersUsed, 10);
        assert.equal(aggregated.totalRendersRemaining, 120); // 110 + 10
        assert.equal(aggregated.hasGiftCredits, true);
        assert.equal(aggregated.giftCreditsRemaining, 10);
    });

    it("should pick available subscription for render deduction", () => {
        const activeSubs: SubscriptionData[] = [
            {
                id: "sub-paid-1",
                user_id: "user-1",
                status: "active",
                autopay_status: "active",
                renders_used: 35,
                valid_from: "2026-08-24T00:00:00Z",
                valid_until: "2026-09-24T00:00:00Z",
                created_at: "2026-08-24T00:00:00Z",
                plan: monthlyOfferPlan // 40 max, 35 used = 5 remaining
            },
            {
                id: "sub-gift-1",
                user_id: "user-1",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-24T01:00:00Z",
                valid_until: "2026-09-24T01:00:00Z",
                created_at: "2026-08-24T01:00:00Z",
                plan: welcomePlan // 10 remaining
            }
        ];

        // Render cost 8 credits: paid sub only has 5 credits left, so pick gift sub with 10 credits
        const picked = pickSubscriptionForRender(activeSubs, 8);
        assert.equal(picked?.subscription.id, "sub-gift-1");
        assert.equal(picked?.deductionSource, "gift");
    });
});
