import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { getRazorpayInstance } from "@/lib/razorpay";
import { convertPaiseToUSD } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/create-order
 * Creates Razorpay subscription order for a plan
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        const body = await request.json();
        const { planId, fullName, companyName, email, phone, currency = "INR" } = body;

        if (!planId || !fullName || !email || !phone) {
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

        // Check for existing active, non-expired subscription (to determine upgrade)
        const { data: existingSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("valid_until", new Date().toISOString())
            .maybeSingle();

        // Calculate amount and currency for Razorpay
        const isUSD = currency === "USD";
        // For USD: rounded whole dollar amount in cents (e.g. $10 -> 1000 cents)
        // For INR: price_total in paise (e.g. ₹899 -> 89900 paise)
        const orderAmount = isUSD ? convertPaiseToUSD(plan.price_total) * 100 : plan.price_total;
        const orderCurrency = isUSD ? "USD" : "INR";

        // Create Razorpay order
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.create({
            amount: orderAmount,
            currency: orderCurrency,
            receipt: `sub_${Date.now()}`,
            notes: {
                planId: plan.id,
                userId,
                fullName,
                companyName: companyName || "",
                email,
                phone,
                currency: orderCurrency,
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
                amount: orderAmount
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
            amount: orderAmount,
            currency: orderCurrency,
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
            { error: "Failed to create order" },
            { status: 500 }
        );
    }
}

