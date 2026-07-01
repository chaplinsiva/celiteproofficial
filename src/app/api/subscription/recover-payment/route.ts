import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { getRazorpayInstance } from "@/lib/razorpay";
import { sendSubscriptionWelcomeEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/recover-payment
 *
 * Recovery endpoint for users who closed their browser during the post-payment redirect window.
 * Given a Razorpay order ID, this endpoint:
 *  1. Verifies the order was actually paid (captured) on Razorpay's side
 *  2. Idempotently creates the subscription if missing
 *  3. Returns the subscription status so the UI can confirm activation
 *
 * This is safe to call multiple times — it will never double-charge or create duplicate subscriptions.
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId: authenticatedUserId, user } = authResult;

    try {
        const body = await request.json();
        const { orderId } = body;

        if (!orderId) {
            return NextResponse.json(
                { error: "orderId is required" },
                { status: 400 }
            );
        }

        // --- Step 1: Fetch order from Razorpay ---
        const razorpay = await getRazorpayInstance();
        let order: any;
        try {
            order = await razorpay.orders.fetch(orderId);
        } catch (err) {
            console.error(`[RecoverPayment] Failed to fetch order ${orderId} from Razorpay:`, err);
            return NextResponse.json(
                { error: "Order not found. Please contact support." },
                { status: 404 }
            );
        }

        // --- Step 2: Ownership check ---
        const userId = order.notes?.userId as string;
        const planId = order.notes?.planId as string;

        if (!userId || !planId) {
            return NextResponse.json(
                { error: "Invalid order: missing user or plan information." },
                { status: 400 }
            );
        }

        if (userId !== authenticatedUserId) {
            return NextResponse.json(
                { error: "Forbidden: this order does not belong to your account." },
                { status: 403 }
            );
        }

        // --- Step 3: Check payment was actually captured ---
        // Razorpay order status is "paid" once fully captured
        if (order.status !== "paid") {
            return NextResponse.json(
                {
                    recovered: false,
                    pending: true,
                    message: `Payment not yet confirmed by Razorpay (status: ${order.status}). Please wait a few moments and try again.`,
                },
                { status: 200 }
            );
        }

        // --- Step 4: Check if subscription already exists for this order ---
        // First check by payment_id if we can find it from the order's payments
        let paymentId: string | null = null;
        try {
            const payments = await razorpay.orders.fetchPayments(orderId);
            const capturedPayment = (payments as any).items?.find(
                (p: any) => p.status === "captured"
            );
            paymentId = capturedPayment?.id || null;
        } catch (err) {
            console.error(`[RecoverPayment] Could not fetch payments for order ${orderId}:`, err);
        }

        // Idempotency check by payment ID
        if (paymentId) {
            const { data: existingSubByPayment } = await supabaseAdmin
                .from("user_subscriptions")
                .select("id, valid_until, plan:subscription_plans(name, billing_cycle, render_limit, storage_limit_gb)")
                .eq("razorpay_payment_id", paymentId)
                .maybeSingle();

            if (existingSubByPayment) {
                console.log(`[RecoverPayment] Subscription already exists for payment ${paymentId}.`);
                const plan = existingSubByPayment.plan as any;
                return NextResponse.json({
                    recovered: true,
                    alreadyActive: true,
                    message: "Your subscription is already active!",
                    subscription: {
                        id: existingSubByPayment.id,
                        validUntil: existingSubByPayment.valid_until,
                        planName: plan?.name,
                        billingCycle: plan?.billing_cycle,
                    },
                });
            }
        }

        // Idempotency check by order ID (fallback)
        const { data: existingSubByOrder } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id, valid_until, plan:subscription_plans(name, billing_cycle, render_limit, storage_limit_gb)")
            .eq("razorpay_order_id", orderId)
            .maybeSingle();

        if (existingSubByOrder) {
            console.log(`[RecoverPayment] Subscription already exists for order ${orderId}.`);
            const plan = existingSubByOrder.plan as any;
            return NextResponse.json({
                recovered: true,
                alreadyActive: true,
                message: "Your subscription is already active!",
                subscription: {
                    id: existingSubByOrder.id,
                    validUntil: existingSubByOrder.valid_until,
                    planName: plan?.name,
                    billingCycle: plan?.billing_cycle,
                },
            });
        }

        // --- Step 5: Fetch plan details ---
        const { data: plan } = await supabaseAdmin
            .from("subscription_plans")
            .select("*")
            .eq("id", planId)
            .single();

        if (!plan) {
            return NextResponse.json(
                { error: "Plan not found. Please contact support." },
                { status: 404 }
            );
        }

        // --- Step 6: Cancel old subscription if this was an upgrade ---
        const isUpgrade = order.notes?.isUpgrade === "true";
        const existingSubId = order.notes?.existingSubId as string;
        const now = new Date();

        if (isUpgrade && existingSubId) {
            await supabaseAdmin
                .from("user_subscriptions")
                .update({ status: "cancelled", updated_at: now.toISOString() })
                .eq("id", existingSubId);
        }

        // --- Step 7: Calculate validity ---
        const validUntil = new Date(now);
        if (plan.billing_cycle === "yearly") {
            validUntil.setFullYear(validUntil.getFullYear() + 1);
        } else {
            validUntil.setMonth(validUntil.getMonth() + 1);
        }

        // --- Step 8: Create subscription ---
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
                razorpay_order_id: orderId,
            })
            .select()
            .single();

        if (subError) {
            if (subError.code === "23505") {
                // Race condition — already created by webhook, fetch and return
                const { data: raceSub } = await supabaseAdmin
                    .from("user_subscriptions")
                    .select("id, valid_until")
                    .eq("razorpay_order_id", orderId)
                    .single();
                return NextResponse.json({
                    recovered: true,
                    alreadyActive: true,
                    message: "Your subscription is now active!",
                    subscription: {
                        id: raceSub?.id,
                        validUntil: raceSub?.valid_until,
                        planName: plan.name,
                        billingCycle: plan.billing_cycle,
                    },
                });
            }
            console.error(`[RecoverPayment] Failed to create subscription:`, subError);
            return NextResponse.json(
                { error: "Failed to activate subscription. Please contact support." },
                { status: 500 }
            );
        }

        console.log(`[RecoverPayment] ✅ Subscription ${subscription.id} created for user ${userId} via recovery.`);

        // --- Step 9: Log the activity ---
        await supabaseAdmin.from("user_logs").insert({
            user_id: userId,
            action: "subscription_activated",
            data: {
                planId: plan.id,
                planName: plan.name,
                billingCycle: plan.billing_cycle,
                paymentId,
                orderId,
                amount: order.amount,
                currency: order.currency,
                source: "recovery",
            }
        });

        // --- Step 10: Mark subscription_orders as completed ---
        await supabaseAdmin
            .from("subscription_orders")
            .update({ status: "completed", updated_at: now.toISOString() })
            .eq("razorpay_order_id", orderId);

        // --- Step 11: Send welcome email ---
        const emailTo = user?.email || (order.notes?.email as string);
        if (emailTo) {
            sendSubscriptionWelcomeEmail(
                emailTo,
                plan.name,
                subscription.valid_until,
                plan.render_limit,
                plan.storage_limit_gb
            ).catch(err => {
                console.error("[RecoverPayment] Failed to send welcome email:", err);
            });
        }

        return NextResponse.json({
            recovered: true,
            alreadyActive: false,
            message: "Subscription successfully activated!",
            subscription: {
                id: subscription.id,
                validUntil: subscription.valid_until,
                planName: plan.name,
                billingCycle: plan.billing_cycle,
            },
        });

    } catch (error) {
        console.error("[RecoverPayment] Unexpected error:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred. Please try again or contact support." },
            { status: 500 }
        );
    }
}
