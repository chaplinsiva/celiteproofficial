// agent-notes: { ctx: "Unit tests for 499 monthly offer subscription plan", deps: ["src/lib/currency.ts"], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatINR, formatUSD, formatPriceByCurrency, convertPaiseToUSD } from "@/lib/currency";

export interface SubscriptionPlanInput {
    name: string;
    billing_cycle: "monthly" | "yearly";
    price_monthly: number;
    price_total: number;
    render_limit: number;
    storage_limit_gb: number;
    is_active: boolean;
}

export function validateMonthlyOfferPlan(plan: SubscriptionPlanInput): boolean {
    if (plan.name !== "Monthly Offer" && plan.name !== "Special Offer") return false;
    if (plan.billing_cycle !== "monthly") return false;
    if (plan.price_monthly !== 49900 || plan.price_total !== 49900) return false;
    if (plan.render_limit !== 40) return false;
    if (plan.storage_limit_gb !== 5) return false;
    if (!plan.is_active) return false;
    return true;
}

describe("499 Monthly Offer Subscription Plan Validation & Pricing", () => {
    it("should validate the 499 monthly offer plan specifications", () => {
        const newOfferPlan: SubscriptionPlanInput = {
            name: "Monthly Offer",
            billing_cycle: "monthly",
            price_monthly: 49900,
            price_total: 49900,
            render_limit: 40,
            storage_limit_gb: 5,
            is_active: true
        };

        assert.equal(validateMonthlyOfferPlan(newOfferPlan), true);
        assert.equal(newOfferPlan.price_monthly / 100, 499);
        assert.equal(newOfferPlan.render_limit, 40);
        assert.equal(newOfferPlan.storage_limit_gb, 5);
    });

    it("should format INR and USD currency correctly for 49900 paise", () => {
        const paise = 49900;
        assert.equal(formatINR(paise), "499");
        assert.equal(convertPaiseToUSD(paise), 6);
        assert.equal(formatUSD(paise), "6");
        assert.equal(formatPriceByCurrency(paise, "INR"), "₹499");
        assert.equal(formatPriceByCurrency(paise, "USD"), "$6");
    });

    it("should reject invalid monthly offer configurations", () => {
        const invalidPlan: SubscriptionPlanInput = {
            name: "Monthly Offer",
            billing_cycle: "monthly",
            price_monthly: 89900, // wrong price
            price_total: 89900,
            render_limit: 60,
            storage_limit_gb: 5,
            is_active: true
        };

        assert.equal(validateMonthlyOfferPlan(invalidPlan), false);
    });
});
