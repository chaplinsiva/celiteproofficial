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
        const { planId, userId, fullName, companyName, email, phone } = body;

        if (!planId || !userId || !fullName || !email || !phone) {
            return NextResponse.json(
                { error: "Plan details and user contact info are required" },
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
            return NextResponse.json({ error: "Invalid subscription plan" }, { status: 404 });
        }

        // Check for existing active subscription
        const { data: existingSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "active")
            .maybeSingle();

        // Create Razorpay order
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.create({
            amount: plan.price_total,
            currency: "INR",
            receipt: `sub_${Date.now()}`,
            notes: {
                planId: plan.id,
                userId,
                fullName,
                companyName: companyName || "",
                email,
                phone,
                isUpgrade: existingSub ? "true" : "false",
                existingSubId: existingSub?.id || "",
            },
        });

        // Store order in database
        const { error: dbError } = await supabaseAdmin
            .from("subscription_orders")
            .insert({
                user_id: userId,
                plan_id: planId,
                full_name: fullName,
                company_name: companyName || null,
                email,
                phone,
                status: "initialized",
                razorpay_order_id: order.id,
                amount: plan.price_total
            });

        if (dbError) {
            console.error("Failed to store subscription order:", dbError);
            // We continue even if DB logging fails, but we've logged it
        }

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
