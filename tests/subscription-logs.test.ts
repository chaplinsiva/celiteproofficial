// agent-notes: { ctx: "Unit tests for admin subscription logs normalization, filtering, and stats using subscription_orders exact schema", deps: ["src/lib/subscription-logs.ts"], state: active, last: "tara@2026-08-24" }
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeSubscriptionLogs, filterSubscriptionLogs, RawSubscriptionOrder, RawUserSubscription } from "../src/lib/subscription-logs";

describe("Admin Subscription Logs Processing & Filtering", () => {
    const plansMap: Record<string, { name: string; price_monthly: number; render_limit: number }> = {
        "50a7ec25-9f4e-468a-a577-e157edad9498": { name: "Monthly Offer", price_monthly: 89900, render_limit: 40 },
        "cefc4350-8495-4d7d-8591-e4969bb35868": { name: "Creator", price_monthly: 159900, render_limit: 120 },
        "847267f6-3934-4d63-9e92-c566413fb884": { name: "Pro", price_monthly: 249900, render_limit: 250 },
        "gift-plan-id": { name: "Welcome Gift", price_monthly: 0, render_limit: 10 },
    };

    const rawOrders: RawSubscriptionOrder[] = [
        {
            id: "4a6174cb-4703-4b6e-924d-e99f955e96dd",
            user_id: "3e80d89b-eec1-4aca-a562-80d702f0b8b3",
            plan_id: "50a7ec25-9f4e-468a-a577-e157edad9498",
            full_name: "Rijith",
            company_name: null,
            email: "rajeevi1402@gmail.com",
            phone: "9677830090",
            status: "initialized",
            razorpay_order_id: "order_TTQDx3M1gdjbpM",
            amount: 1000,
            created_at: "2026-08-24T01:15:27.626548Z",
        },
        {
            id: "bdb4473b-2106-4365-8f8b-483fb467b2aa",
            user_id: "42f0f89d-27ad-4cba-a8d6-45514b273d9f",
            plan_id: "50a7ec25-9f4e-468a-a577-e157edad9498",
            full_name: "Gokul Vasan",
            company_name: null,
            email: "gokulavasan145@gmail.com",
            phone: "+916382752523",
            status: "completed",
            razorpay_order_id: "order_TRMDLPJ4sJ3rkY",
            amount: 89900,
            created_at: "2026-08-18T20:02:07.129012Z",
        },
        {
            id: "16fd6881-3ba4-4123-a82b-6f7b71b204bc",
            user_id: "97bcff9d-fe4b-4444-bcf7-ec2c44d2a62a",
            plan_id: "50a7ec25-9f4e-468a-a577-e157edad9498",
            full_name: "Badri Navi",
            company_name: null,
            email: "badrinavi2717@gmail.com",
            phone: "+918883372603",
            status: "failed",
            razorpay_order_id: "order_TOyux3gn7gsP2r",
            amount: 89900,
            created_at: "2026-08-12T19:56:44.964355Z",
        },
        {
            id: "1be853b5-3736-4def-9806-6aecf6ae73e9",
            user_id: "5e015813-0cb6-4d67-b4b0-9864c5df94b8",
            plan_id: "50a7ec25-9f4e-468a-a577-e157edad9498",
            full_name: "thasa",
            company_name: "Celite Creators",
            email: "freefireashacker@gmail.com",
            phone: "+14344342",
            status: "initialized",
            razorpay_order_id: "order_TSTl8mMk2tM8eE",
            amount: 89900,
            created_at: "2026-08-21T16:03:57.535952Z",
        }
    ];

    const rawSubscriptions: RawUserSubscription[] = [
        {
            id: "sub-gift-1",
            user_id: "3e80d89b-eec1-4aca-a562-80d702f0b8b3",
            plan_id: "gift-plan-id",
            status: "active",
            autopay_status: "active",
            renders_used: 2,
            valid_from: "2026-08-24T00:00:00Z",
            valid_until: "2026-09-24T00:00:00Z",
            created_at: "2026-08-24T00:00:00Z",
        }
    ];

    it("should normalize subscription_orders with full names, phone numbers, emails, and statuses", () => {
        const logs = normalizeSubscriptionLogs(rawOrders, rawSubscriptions, plansMap, {});

        assert.equal(logs.length, 5); // 4 orders + 1 welcome gift sub
        assert.equal(logs[0].id, "order-4a6174cb-4703-4b6e-924d-e99f955e96dd");
        assert.equal(logs[0].fullName, "Rijith");
        assert.equal(logs[0].phone, "9677830090");
        assert.equal(logs[0].userEmail, "rajeevi1402@gmail.com");
        assert.equal(logs[0].status, "created");

        // Verified completed order
        const completedLog = logs.find(l => l.id === "order-bdb4473b-2106-4365-8f8b-483fb467b2aa");
        assert.ok(completedLog);
        assert.equal(completedLog?.fullName, "Gokul Vasan");
        assert.equal(completedLog?.status, "paid");
        assert.equal(completedLog?.amount, 89900);
    });

    it("should filter logs by customer name, phone, company, and status", () => {
        const logs = normalizeSubscriptionLogs(rawOrders, rawSubscriptions, plansMap, {});

        // Search by company
        const companyFiltered = filterSubscriptionLogs(logs, { search: "Celite Creators" });
        assert.equal(companyFiltered.length, 1);
        assert.equal(companyFiltered[0].fullName, "thasa");

        // Search by phone
        const phoneFiltered = filterSubscriptionLogs(logs, { search: "6382752523" });
        assert.equal(phoneFiltered.length, 1);
        assert.equal(phoneFiltered[0].fullName, "Gokul Vasan");

        // Filter by failed status
        const failedFiltered = filterSubscriptionLogs(logs, { status: "failed" });
        assert.equal(failedFiltered.length, 1);
        assert.equal(failedFiltered[0].fullName, "Badri Navi");

        // Filter by paid / completed status
        const paidFiltered = filterSubscriptionLogs(logs, { status: "paid" });
        assert.equal(paidFiltered.length, 1);
        assert.equal(paidFiltered[0].fullName, "Gokul Vasan");
    });
});
