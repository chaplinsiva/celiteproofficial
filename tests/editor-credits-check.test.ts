// agent-notes: { ctx: "Unit tests for editor credit validation and shortfall calculations", deps: [], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";

export function checkEditorRenderCredits(
    subscriptionData: {
        hasSubscription?: boolean;
        hasExpiredCredits?: boolean;
        expiredCredits?: { remaining: number };
        plan?: { renderLimit: number | null };
        subscription?: { rendersRemaining: number | null };
        warnings?: { rendersExhausted?: boolean };
    } | null,
    templateCost: number = 20
): { canRender: boolean; userCredits: number; shortfall: number; reason: "no_subscription" | "insufficient_credits" | "ok" } {
    if (!subscriptionData) {
        return { canRender: false, userCredits: 0, shortfall: templateCost, reason: "no_subscription" };
    }

    const hasSub = !!subscriptionData.hasSubscription;
    const hasExp = !!subscriptionData.hasExpiredCredits && !!subscriptionData.expiredCredits;
    const isUnlimited = hasSub && subscriptionData.plan?.renderLimit === null;

    if (isUnlimited) {
        return { canRender: true, userCredits: Infinity, shortfall: 0, reason: "ok" };
    }

    const userCredits = subscriptionData.subscription?.rendersRemaining ?? (hasExp ? subscriptionData.expiredCredits?.remaining ?? 0 : 0);

    if (!hasSub && !hasExp) {
        return { canRender: false, userCredits: 0, shortfall: templateCost, reason: "no_subscription" };
    }

    if (userCredits < templateCost) {
        return {
            canRender: false,
            userCredits,
            shortfall: Math.max(0, templateCost - userCredits),
            reason: "insufficient_credits"
        };
    }

    return { canRender: true, userCredits, shortfall: 0, reason: "ok" };
}

describe("Editor Render Credits Validation", () => {
    it("should reject and calculate 20 shortfall when user has no subscription", () => {
        const result = checkEditorRenderCredits(null, 20);
        assert.equal(result.canRender, false);
        assert.equal(result.userCredits, 0);
        assert.equal(result.shortfall, 20);
        assert.equal(result.reason, "no_subscription");
    });

    it("should reject and calculate shortfall when user has only 10 gift credits for a 20 credit template", () => {
        const result = checkEditorRenderCredits({
            hasSubscription: true,
            plan: { renderLimit: 10 },
            subscription: { rendersRemaining: 10 },
            warnings: { rendersExhausted: false }
        }, 20);

        assert.equal(result.canRender, false);
        assert.equal(result.userCredits, 10);
        assert.equal(result.shortfall, 10); // 20 - 10 = 10 needed
        assert.equal(result.reason, "insufficient_credits");
    });

    it("should allow render when user has 50 stacked credits (40 plan + 10 gift)", () => {
        const result = checkEditorRenderCredits({
            hasSubscription: true,
            plan: { renderLimit: 50 },
            subscription: { rendersRemaining: 50 },
            warnings: { rendersExhausted: false }
        }, 20);

        assert.equal(result.canRender, true);
        assert.equal(result.userCredits, 50);
        assert.equal(result.shortfall, 0);
        assert.equal(result.reason, "ok");
    });

    it("should allow render for unlimited plan", () => {
        const result = checkEditorRenderCredits({
            hasSubscription: true,
            plan: { renderLimit: null },
            subscription: { rendersRemaining: null }
        }, 20);

        assert.equal(result.canRender, true);
        assert.equal(result.shortfall, 0);
        assert.equal(result.reason, "ok");
    });
});
