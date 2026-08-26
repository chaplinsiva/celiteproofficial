// agent-notes: { ctx: "Unit tests for preview entitlements and HD render credit permissions", deps: ["src/lib/subscription-credits.ts"], state: active, last: "tara@2026-08-26" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateActiveSubscriptions, PlanData, SubscriptionData } from "../src/lib/subscription-credits";

export interface PreviewEligibilityResult {
    canPreview: boolean;
    hasUnlimitedPreviews: boolean;
    reason: "requires_paid_subscription" | "ok";
}

export function checkPreviewEligibility(
    subscriptionData: {
        hasPaidSubscription?: boolean;
        hasUnlimitedPreviews?: boolean;
    } | null | undefined
): PreviewEligibilityResult {
    if (!subscriptionData?.hasPaidSubscription) {
        return {
            canPreview: false,
            hasUnlimitedPreviews: false,
            reason: "requires_paid_subscription",
        };
    }

    return {
        canPreview: true,
        hasUnlimitedPreviews: true,
        reason: "ok",
    };
}

describe("Preview Entitlements & HD Render Permission Enforcement", () => {
    const welcomePlan: PlanData = {
        id: "plan-gift",
        name: "Welcome Gift",
        billing_cycle: "monthly",
        price_monthly: 0,
        render_limit: 10,
        storage_limit_gb: 1
    };

    const monthlyPaidPlan: PlanData = {
        id: "plan-monthly-pro",
        name: "Monthly Pro",
        billing_cycle: "monthly",
        price_monthly: 49900,
        render_limit: 40,
        storage_limit_gb: 5
    };

    it("1. Free user (no subscription) CANNOT preview, but gets 0 render credits", () => {
        const aggregated = aggregateActiveSubscriptions([]);
        const previewCheck = checkPreviewEligibility(aggregated);

        assert.equal(aggregated.hasSubscription, false);
        assert.equal(aggregated.hasPaidSubscription, false);
        assert.equal(aggregated.hasUnlimitedPreviews, false);
        assert.equal(previewCheck.canPreview, false);
        assert.equal(previewCheck.reason, "requires_paid_subscription");
        assert.equal(aggregated.totalRendersRemaining, 0);
    });

    it("2. Welcome Gift ONLY user CANNOT preview, but HAS 10 credits for HD renders", () => {
        const giftSubs: SubscriptionData[] = [
            {
                id: "sub-gift-1",
                user_id: "user-welcome",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-26T00:00:00Z",
                valid_until: "2026-09-26T00:00:00Z",
                created_at: "2026-08-26T00:00:00Z",
                plan: welcomePlan
            }
        ];

        const aggregated = aggregateActiveSubscriptions(giftSubs);
        const previewCheck = checkPreviewEligibility(aggregated);

        // Free preview strictly disallowed
        assert.equal(aggregated.hasPaidSubscription, false);
        assert.equal(aggregated.hasUnlimitedPreviews, false);
        assert.equal(previewCheck.canPreview, false);
        assert.equal(previewCheck.reason, "requires_paid_subscription");

        // Welcome gift credits are still available for full HD renders!
        assert.equal(aggregated.hasSubscription, true);
        assert.equal(aggregated.hasGiftCredits, true);
        assert.equal(aggregated.giftCreditsRemaining, 10);
        assert.equal(aggregated.totalRendersRemaining, 10);
    });

    it("3. Paid subscriber HAS unlimited previews AND HD render credits", () => {
        const paidSubs: SubscriptionData[] = [
            {
                id: "sub-paid-1",
                user_id: "user-paid",
                status: "active",
                autopay_status: "active",
                renders_used: 5,
                valid_from: "2026-08-26T00:00:00Z",
                valid_until: "2026-09-26T00:00:00Z",
                created_at: "2026-08-26T00:00:00Z",
                plan: monthlyPaidPlan
            }
        ];

        const aggregated = aggregateActiveSubscriptions(paidSubs);
        const previewCheck = checkPreviewEligibility(aggregated);

        assert.equal(aggregated.hasPaidSubscription, true);
        assert.equal(aggregated.hasUnlimitedPreviews, true);
        assert.equal(previewCheck.canPreview, true);
        assert.equal(previewCheck.reason, "ok");
        assert.equal(aggregated.totalRendersRemaining, 35); // 40 - 5
    });

    it("4. Stacked Paid + Welcome Gift user HAS unlimited previews AND stacked HD credits", () => {
        const stackedSubs: SubscriptionData[] = [
            {
                id: "sub-gift-1",
                user_id: "user-stacked",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-26T00:00:00Z",
                valid_until: "2026-09-26T00:00:00Z",
                created_at: "2026-08-26T00:00:00Z",
                plan: welcomePlan
            },
            {
                id: "sub-paid-1",
                user_id: "user-stacked",
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                valid_from: "2026-08-26T01:00:00Z",
                valid_until: "2026-09-26T01:00:00Z",
                created_at: "2026-08-26T01:00:00Z",
                plan: monthlyPaidPlan
            }
        ];

        const aggregated = aggregateActiveSubscriptions(stackedSubs);
        const previewCheck = checkPreviewEligibility(aggregated);

        assert.equal(aggregated.hasPaidSubscription, true);
        assert.equal(aggregated.hasUnlimitedPreviews, true);
        assert.equal(previewCheck.canPreview, true);
        assert.equal(aggregated.totalRendersRemaining, 50); // 40 + 10
    });
});
