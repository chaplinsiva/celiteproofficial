import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { getRazorpayInstance } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/create-order
 * Creates Razorpay subscription order for a plan
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const body = await request.json();
        const { planId, userId } = body;

        if (!planId || !userId) {
            return NextResponse.json(
                { error: "planId and userId are required" },
                { status: 400 }
            );
        }

        // Fetch the plan
        const { data: plan, error: planError } = await supabaseAdmin
            .from("subscription_plans")
            .select("*")
            .eq("id", planId)
            .eq("is_active", true)
            .single();

        if (planError || !plan) {
            return NextResponse.json(
                { error: "Invalid subscription plan" },
                { status: 404 }
            );
        }

        // Check for existing active subscription
        const { data: existingSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id, status")
            .eq("user_id", userId)
            .eq("status", "active")
            .single();

        // Create Razorpay order
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.create({
            amount: plan.price_total,
            currency: "INR",
            receipt: `sub_${Date.now()}`,
            notes: {
                planId: plan.id,
                planName: plan.name,
                billingCycle: plan.billing_cycle,
                userId,
                isUpgrade: existingSub ? "true" : "false",
                existingSubId: existingSub?.id || "",
            },
        });

        // Get Razorpay Key ID for frontend
        const { data: config } = await supabaseAdmin
            .from("razorpay_config")
            .select("key_id")
            .single();

        return NextResponse.json({
            orderId: order.id,
            amount: plan.price_total,
            currency: "INR",
            keyId: config?.key_id,
            plan: {
                id: plan.id,
                name: plan.name,
                billingCycle: plan.billing_cycle,
                renderLimit: plan.render_limit,
                storageLimitGb: plan.storage_limit_gb,
            },
            isUpgrade: !!existingSub,
        });

    } catch (error) {
        console.error("Create subscription order error:", error);
        return NextResponse.json(
            { error: "Failed to create order", details: String(error) },
            { status: 500 }
        );
    }
}
