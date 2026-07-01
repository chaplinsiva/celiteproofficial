import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { verifyPaymentSignature, getRazorpaySecret, getRazorpayInstance } from "@/lib/razorpay";
import { sendSubscriptionWelcomeEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/verify-payment
 * Verifies Razorpay payment and creates/updates user subscription
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId: authenticatedUserId, user } = authResult;

    try {
        const body = await request.json();
        const { orderId, paymentId, signature } = body;

        if (!orderId || !paymentId || !signature) {
            return NextResponse.json(
                { error: "orderId, paymentId, and signature are required" },
                { status: 400 }
            );
        }

        // Verify signature
        const secret = await getRazorpaySecret();
        const isValid = verifyPaymentSignature(orderId, paymentId, signature, secret);

        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid payment signature" },
                { status: 400 }
            );
        }

        // Get order details from Razorpay
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.fetch(orderId);

        const planId = order.notes?.planId as string;
        const userId = order.notes?.userId as string;
        const isUpgrade = order.notes?.isUpgrade === "true";
        const existingSubId = order.notes?.existingSubId as string;

        if (!planId || !userId) {
            return NextResponse.json(
                { error: "Invalid order data" },
                { status: 400 }
            );
        }

        // Ownership check: ensure this order belongs to the authenticated user
        if (userId !== authenticatedUserId) {
            return NextResponse.json(
                { error: "Forbidden: order does not belong to this user" },
                { status: 403 }
            );
        }

        // Fetch plan details
        const { data: plan } = await supabaseAdmin
            .from("subscription_plans")
            .select("*")
            .eq("id", planId)
            .single();

        if (!plan) {
            return NextResponse.json(
                { error: "Plan not found" },
                { status: 404 }
            );
        }

        // Calculate validity period
        const now = new Date();
        const validUntil = new Date(now);
        if (plan.billing_cycle === "yearly") {
            validUntil.setFullYear(validUntil.getFullYear() + 1);
        } else {
            validUntil.setMonth(validUntil.getMonth() + 1);
        }

        // If upgrading, cancel old subscription
        if (isUpgrade && existingSubId) {
            await supabaseAdmin
                .from("user_subscriptions")
                .update({
                    status: "cancelled",
                    updated_at: now.toISOString()
                })
                .eq("id", existingSubId);
        }

        // Idempotency: if subscription for this payment already exists, return it
        const { data: existingPaymentSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id, valid_until")
            .eq("razorpay_payment_id", paymentId)
            .maybeSingle();

        if (existingPaymentSub) {
            console.log(`Idempotency: subscription for payment ${paymentId} already exists (${existingPaymentSub.id})`);
            return NextResponse.json({
                success: true,
                subscription: {
                    id: existingPaymentSub.id,
                    planName: plan.name,
                    billingCycle: plan.billing_cycle,
                    renderLimit: plan.render_limit,
                    storageLimitGb: plan.storage_limit_gb,
                    validUntil: existingPaymentSub.valid_until,
                },
            });
        }

        // Create new subscription

        const { data: subscription, error: subError } = await supabaseAdmin
            .from("user_subscriptions")
            .insert({
                user_id: userId,
                plan_id: planId,
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                storage_used_bytes: 0,
                valid_from: now.toISOString(),
                valid_until: validUntil.toISOString(),
                razorpay_payment_id: paymentId,
            })
            .select()
            .single();

        if (subError) {
            console.error("Failed to create subscription:", subError);
            return NextResponse.json(
                { error: "Failed to create subscription" },
                { status: 500 }
            );
        }

        // Log the subscription activity
        await supabaseAdmin.from("user_logs").insert({
            user_id: userId,
            action: "subscription_activated",
            data: {
                planId: plan.id,
                planName: plan.name,
                billingCycle: plan.billing_cycle,
                paymentId,
                amount: order.amount,
                currency: order.currency
            }
        });

        // Send welcome email notification asynchronously
        if (user && user.email) {
            sendSubscriptionWelcomeEmail(
                user.email,
                plan.name,
                subscription.valid_until,
                plan.render_limit,
                plan.storage_limit_gb
            ).catch(err => {
                console.error("[VerifyPayment] Failed to send welcome email:", err);
            });
        }

        // Update order status in database
        await supabaseAdmin
            .from("subscription_orders")
            .update({ status: "completed", updated_at: now.toISOString() })
            .eq("razorpay_order_id", orderId);

        return NextResponse.json({
            success: true,
            subscription: {
                id: subscription.id,
                planName: plan.name,
                billingCycle: plan.billing_cycle,
                renderLimit: plan.render_limit,
                storageLimitGb: plan.storage_limit_gb,
                validUntil: subscription.valid_until,
            },
        });

    } catch (error) {
        console.error("Verify subscription payment error:", error);
        return NextResponse.json(
            { error: "Failed to verify payment" },
            { status: 500 }
        );
    }
}
