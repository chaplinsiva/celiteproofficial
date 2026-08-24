// agent-notes: { ctx: "Unit tests verifying Welcome Gift does not grant unlimited free preview renders", deps: ["src/lib/subscription-credits.ts"], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateActiveSubscriptions, PlanData, SubscriptionData } from "../src/lib/subscription-credits";

describe("Welcome Gift Feature Permissions & Sample Render Limits", () => {
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

    it("should NOT grant unlimited free previews when user only has Welcome Gift", () => {
        const giftSubs: SubscriptionData[] = [
            {
                id: "sub-gift-1",
                user_id: "user-gift-only",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-24T00:00:00Z",
                valid_until: "2026-09-24T00:00:00Z",
                created_at: "2026-08-24T00:00:00Z",
                plan: welcomePlan
            }
        ];

        const aggregated = aggregateActiveSubscriptions(giftSubs);

        assert.equal(aggregated.hasSubscription, true);
        assert.equal(aggregated.hasGiftCredits, true);
        assert.equal(aggregated.hasPaidSubscription, false);
        assert.equal(aggregated.hasUnlimitedPreviews, false);
        assert.equal(aggregated.isWelcomeGiftOnly, true);
    });

    it("should grant unlimited free previews when user has a paid subscription", () => {
        const paidSubs: SubscriptionData[] = [
            {
                id: "sub-paid-1",
                user_id: "user-paid",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-24T00:00:00Z",
                valid_until: "2026-09-24T00:00:00Z",
                created_at: "2026-08-24T00:00:00Z",
                plan: monthlyOfferPlan
            }
        ];

        const aggregated = aggregateActiveSubscriptions(paidSubs);

        assert.equal(aggregated.hasPaidSubscription, true);
        assert.equal(aggregated.hasUnlimitedPreviews, true);
        assert.equal(aggregated.isWelcomeGiftOnly, false);
    });

    it("should grant unlimited free previews when user has BOTH paid subscription AND Welcome Gift", () => {
        const stackedSubs: SubscriptionData[] = [
            {
                id: "sub-gift-1",
                user_id: "user-stacked",
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
                user_id: "user-stacked",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-24T01:00:00Z",
                valid_until: "2026-09-24T01:00:00Z",
                created_at: "2026-08-24T01:00:00Z",
                plan: monthlyOfferPlan
            }
        ];

        const aggregated = aggregateActiveSubscriptions(stackedSubs);

        assert.equal(aggregated.hasPaidSubscription, true);
        assert.equal(aggregated.hasUnlimitedPreviews, true);
        assert.equal(aggregated.isWelcomeGiftOnly, false);
        assert.equal(aggregated.totalRendersRemaining, 50); // 40 + 10
    });
});
