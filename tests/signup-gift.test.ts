// agent-notes: { ctx: "Unit tests for signup scratch gift credit claim logic", deps: [], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";

export interface GiftClaimCheck {
    hasClaimed: boolean;
    hasActiveSubscription: boolean;
}

export function isEligibleForSignupGift(check: GiftClaimCheck): boolean {
    if (check.hasClaimed) return false;
    return true;
}

export function calculateSignupGiftReward() {
    return {
        credits: 10,
        storageGb: 1,
        validityDays: 30,
        planName: "Welcome Gift"
    };
}

export function buildSignupGiftSubscriptionPayload(userId: string, planId: string) {
    const validUntil = new Date();
    validUntil.setMonth(validUntil.getMonth() + 1);

    return {
        user_id: userId,
        plan_id: planId,
        status: "active" as const,
        autopay_status: "active" as const, // Must be 'active', 'cancelled_by_user', or 'cancelled_by_bank'
        renders_used: 0,
        storage_used_bytes: 0,
        valid_from: new Date().toISOString(),
        valid_until: validUntil.toISOString()
    };
}

describe("Signup Scratch Gift Credit Claim System", () => {
    it("should allow first-time signup users to claim their 10 free credits", () => {
        const eligibleUser: GiftClaimCheck = {
            hasClaimed: false,
            hasActiveSubscription: false
        };
        assert.equal(isEligibleForSignupGift(eligibleUser), true);

        const reward = calculateSignupGiftReward();
        assert.equal(reward.credits, 10);
        assert.equal(reward.planName, "Welcome Gift");
    });

    it("should prevent double claiming of signup gift", () => {
        const claimedUser: GiftClaimCheck = {
            hasClaimed: true,
            hasActiveSubscription: false
        };
        assert.equal(isEligibleForSignupGift(claimedUser), false);
    });

    it("should generate a database payload that satisfies user_subscriptions_autopay_status_check", () => {
        const payload = buildSignupGiftSubscriptionPayload("test-user-id", "test-plan-id");
        const validAutopayStatuses = ["active", "cancelled_by_user", "cancelled_by_bank"];
        assert.equal(validAutopayStatuses.includes(payload.autopay_status), true);
        assert.equal(payload.status, "active");
        assert.equal(payload.renders_used, 0);
    });
});
