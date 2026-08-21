import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { getRazorpayInstance, getSinglePayAmount } from "@/lib/razorpay";
import { convertPaiseToUSD } from "@/lib/currency";

export const dynamic = "force-dynamic";

/**
 * Create Razorpay order for payment
 * POST /api/payment/create-order
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        const body = await request.json();
        const { templateId, projectId, singlePay, oneTimePurchase, currency = "INR" } = body;

        if (!templateId) {
            return NextResponse.json(
                { error: "templateId is required" },
                { status: 400 }
            );
        }

        // Get template to fetch price and one-time purchase fields
        const { data: template, error: templateError } = await supabaseAdmin
            .from("templates")
            .select("id, title, price, one_time_price, is_premium, credit_cost")
            .eq("id", templateId)
            .single();

        if (templateError || !template) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            );
        }

        // ── One-Time Purchase: use template-specific pricing ──────────────
        let amount: number;
        if (oneTimePurchase) {
            // Block premium templates from one-time purchase
            if (template.is_premium) {
                return NextResponse.json(
                    { error: "This is a premium template. One-time purchase is not available. Please subscribe to render this template." },
                    { status: 403 }
                );
            }
            amount = template.one_time_price || 10000; // Default ₹100 in paise
        } else if (singlePay) {
            // Legacy single pay flow — dynamic amount from config
            const singlePayAmount = await getSinglePayAmount();
            amount = singlePayAmount;
        } else {
            // Subscription flow
            amount = template.price || 19900;
        }

        // Calculate amount and currency for Razorpay
        const isUSD = currency === "USD";
        const orderAmount = isUSD ? convertPaiseToUSD(amount) * 100 : amount;
        const orderCurrency = isUSD ? "USD" : "INR";

        // Create Razorpay order
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.create({
            amount: orderAmount,
            currency: orderCurrency,
            receipt: `receipt_${Date.now()}`,
            notes: {
                templateId,
                userId,
                projectId: projectId || "",
                templateTitle: template.title,
                singlePay: singlePay ? "true" : "false",
                oneTimePurchase: oneTimePurchase ? "true" : "false",
                creditCost: String(template.credit_cost || 20),
                currency: orderCurrency,
            },
        });

        // Store payment record in database
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from("payments")
            .insert({
                user_id: userId,
                template_id: templateId,
                razorpay_order_id: order.id,
                amount: orderAmount,
                currency: orderCurrency,
                status: "created",
            })
            .select()
            .single();

        if (paymentError) {
            console.error("Failed to create payment record:", paymentError);
            return NextResponse.json(
                { error: "Failed to create payment record" },
                { status: 500 }
            );
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
            paymentId: payment.id,
        });

    } catch (error) {
        console.error("Create order error:", error);
        return NextResponse.json(
            { error: "Failed to create order" },
            { status: 500 }
        );
    }
}

