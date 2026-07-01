import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { getWebhookSecret, getRazorpayInstance } from "@/lib/razorpay";
import { sendSubscriptionWelcomeEmail } from "@/lib/mailer";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Razorpay Webhook Handler
 * POST /api/payment/webhook
 * 
 * Handles payment events from Razorpay:
 * - payment.authorized
 * - payment.captured
 * - payment.failed
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const body = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        if (!signature) {
            return NextResponse.json(
                { error: "Missing signature" },
                { status: 400 }
            );
        }

        // Verify webhook signature
        const webhookSecret = await getWebhookSecret();
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        // Use timing-safe comparison to prevent timing attacks
        let signatureValid = false;
        try {
            signatureValid = crypto.timingSafeEqual(
                Buffer.from(expectedSignature, "hex"),
                Buffer.from(signature, "hex")
            );
        } catch {
            signatureValid = false;
        }

        if (!signatureValid) {
            console.error("Invalid webhook signature");
            return NextResponse.json(
                { error: "Invalid signature" },
                { status: 400 }
            );
        }

        // Parse webhook payload
        const payload = JSON.parse(body);
        const event = payload.event;
        const paymentEntity = payload.payload?.payment?.entity;

        console.log("Razorpay webhook received:", event);

        // Handle different payment events
        switch (event) {
            case "payment.authorized":
            case "payment.captured":
                // Payment successful
                if (paymentEntity) {
                    await handlePaymentSuccess(paymentEntity);
                }
                break;

            case "payment.failed":
                // Payment failed
                if (paymentEntity) {
                    await handlePaymentFailure(paymentEntity);
                }
                break;

            case "subscription.charged":
                // Autopay renewal succeeded — extend validity and reset renders
                if (payload.payload?.subscription?.entity && payload.payload?.payment?.entity) {
                    await handleSubscriptionCharged(
                        payload.payload.subscription.entity,
                        payload.payload.payment.entity
                    );
                }
                break;

            case "subscription.cancelled":
            case "subscription.completed":
                // Bank/user cancelled autopay
                if (payload.payload?.subscription?.entity) {
                    await handleSubscriptionCancelled(payload.payload.subscription.entity);
                }
                break;

            default:
                console.log(`Unhandled webhook event: ${event}`);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}

/**
 * Handle successful payment — SERVER-SIDE SAFETY NET.
 * This is the authoritative subscription creator. It runs even if the user
 * closes their browser immediately after payment, preventing the "payment taken
 * but subscription not activated" dropout bug.
 *
 * Uses idempotency check on razorpay_payment_id to safely handle duplicate events.
 */
async function handlePaymentSuccess(payment: any) {
    try {
        const orderId = payment.order_id;
        const paymentId = payment.id;

        console.log(`[Webhook] handlePaymentSuccess: orderId=${orderId}, paymentId=${paymentId}`);

        // --- Step 1: Update payment & subscription_orders records ---
        await supabaseAdmin
            .from("payments")
            .update({
                razorpay_payment_id: paymentId,
                status: "paid",
                updated_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", orderId);

        await supabaseAdmin
            .from("subscription_orders")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("razorpay_order_id", orderId);

        // --- Step 2: Fetch Razorpay order to get notes ---
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.fetch(orderId);

        const isOneTimePurchase = order.notes?.oneTimePurchase === "true";

        // ── One-Time Purchase: create entitlement (safety net) ───────────
        if (isOneTimePurchase) {
            const templateId = order.notes?.templateId as string;
            const userId = order.notes?.userId as string;

            if (!templateId || !userId) {
                console.error(`[Webhook] One-time purchase order ${orderId} missing templateId or userId in notes.`);
                return;
            }

            // Idempotency check
            const { data: existingEntitlement } = await supabaseAdmin
                .from("user_template_entitlements")
                .select("id")
                .eq("razorpay_order_id", orderId)
                .maybeSingle();

            if (existingEntitlement) {
                console.log(`[Webhook] Idempotency: entitlement for order ${orderId} already exists (${existingEntitlement.id}). Skipping.`);
                return;
            }

            // Fetch template credit_cost
            const { data: template } = await supabaseAdmin
                .from("templates")
                .select("credit_cost, is_premium")
                .eq("id", templateId)
                .single();

            if (template?.is_premium) {
                console.error(`[Webhook] One-time purchase for premium template ${templateId} blocked.`);
                return;
            }

            const creditCost = template?.credit_cost || parseInt(order.notes?.creditCost as string) || 20;

            // Get payment record ID for linking
            const { data: paymentRecord } = await supabaseAdmin
                .from("payments")
                .select("id")
                .eq("razorpay_order_id", orderId)
                .maybeSingle();

            const { data: entitlement, error: entitlementError } = await supabaseAdmin
                .from("user_template_entitlements")
                .insert({
                    user_id: userId,
                    template_id: templateId,
                    credits_remaining: creditCost,
                    status: "active",
                    payment_id: paymentRecord?.id || null,
                    razorpay_order_id: orderId,
                })
                .select()
                .single();

            if (entitlementError) {
                // Unique constraint violation = already created by verify-payment
                if (entitlementError.code === "23505") {
                    console.log(`[Webhook] Entitlement for order ${orderId} already created by another process.`);
                    return;
                }
                console.error(`[Webhook] Failed to create entitlement for order ${orderId}:`, entitlementError);
                return;
            }

            console.log(`[Webhook] ✅ Entitlement ${entitlement.id} created for user ${userId}, template ${templateId} (safety net).`);

            // Log the activity
            await supabaseAdmin.from("user_logs").insert({
                user_id: userId,
                action: "one_time_render_purchased",
                data: {
                    templateId,
                    entitlementId: entitlement.id,
                    creditCost,
                    paymentId,
                    orderId,
                    amount: order.amount,
                    currency: order.currency,
                    source: "webhook",
                }
            });

            return; // Skip subscription creation
        }

        // ── Subscription flow (existing logic) ──────────────────────────

        // Idempotency check — if subscription already exists, skip
        const { data: existingSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id")
            .eq("razorpay_payment_id", paymentId)
            .maybeSingle();

        if (existingSub) {
            console.log(`[Webhook] Idempotency: subscription for payment ${paymentId} already exists (${existingSub.id}). Skipping.`);
            return;
        }

        const planId = order.notes?.planId as string;
        const userId = order.notes?.userId as string;
        const isUpgrade = order.notes?.isUpgrade === "true";
        const existingSubId = order.notes?.existingSubId as string;

        if (!planId || !userId) {
            console.error(`[Webhook] Order ${orderId} missing planId or userId in notes. Cannot create subscription.`);
            return;
        }

        // Fetch plan details
        const { data: plan } = await supabaseAdmin
            .from("subscription_plans")
            .select("*")
            .eq("id", planId)
            .single();

        if (!plan) {
            console.error(`[Webhook] Plan ${planId} not found for order ${orderId}`);
            return;
        }

        // Calculate validity
        const now = new Date();
        const validUntil = new Date(now);
        if (plan.billing_cycle === "yearly") {
            validUntil.setFullYear(validUntil.getFullYear() + 1);
        } else {
            validUntil.setMonth(validUntil.getMonth() + 1);
        }

        // Cancel old subscription if this is an upgrade
        if (isUpgrade && existingSubId) {
            await supabaseAdmin
                .from("user_subscriptions")
                .update({ status: "cancelled", updated_at: now.toISOString() })
                .eq("id", existingSubId);
            console.log(`[Webhook] Cancelled old subscription ${existingSubId} for upgrade.`);
        }

        // Create the subscription row
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
                console.log(`[Webhook] Subscription for payment ${paymentId} already created by another process (race condition handled).`);
                return;
            }
            console.error(`[Webhook] Failed to create subscription for payment ${paymentId}:`, subError);
            return;
        }

        console.log(`[Webhook] ✅ Subscription ${subscription.id} created for user ${userId} via webhook (safety net).`);

        // Log the activity
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
                source: "webhook",
            }
        });

        // Send welcome email
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", userId)
            .single();

        const emailTo = profile?.email || (order.notes?.email as string);
        if (emailTo) {
            sendSubscriptionWelcomeEmail(
                emailTo,
                plan.name,
                subscription.valid_until,
                plan.render_limit,
                plan.storage_limit_gb
            ).catch(err => {
                console.error("[Webhook] Failed to send welcome email:", err);
            });
        }

    } catch (error) {
        console.error("[Webhook] Error in handlePaymentSuccess:", error);
    }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(payment: any) {
    try {
        const orderId = payment.order_id;
        const paymentId = payment.id;

        // Update payment record
        const { error } = await supabaseAdmin
            .from("payments")
            .update({
                razorpay_payment_id: paymentId,
                status: "failed",
                updated_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", orderId);

        // Update subscription_orders as well
        await supabaseAdmin
            .from("subscription_orders")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("razorpay_order_id", orderId);

        if (error) {
            console.error("Failed to update payment:", error);
        } else {
            console.log(`Payment ${paymentId} marked as failed`);
        }
    } catch (error) {
        console.error("Error handling payment failure:", error);
    }
}
/**
 * Handle successful subscription charge (Autopay success)
 */
async function handleSubscriptionCharged(rzpSub: any, payment: any) {
    try {
        const subId = rzpSub.id;

        // Find existing subscription in our DB
        const { data: subscription } = await supabaseAdmin
            .from("user_subscriptions")
            .select("*, plan:subscription_plans(*)")
            .eq("razorpay_subscription_id", subId)
            .eq("status", "active")
            .single();

        if (!subscription) {
            console.error(`Subscription ${subId} not found for charging`);
            return;
        }

        const plan = subscription.plan as any;
        const now = new Date();
        const validUntil = new Date(subscription.valid_until);

        // Extend from current expiry or now, whichever is later
        const baseDate = validUntil > now ? validUntil : now;
        const newValidUntil = new Date(baseDate);
        if (plan.billing_cycle === "yearly") {
            newValidUntil.setFullYear(newValidUntil.getFullYear() + 1);
        } else {
            newValidUntil.setMonth(newValidUntil.getMonth() + 1);
        }

        // Update subscription: extend validity and reset renders
        await supabaseAdmin
            .from("user_subscriptions")
            .update({
                valid_until: newValidUntil.toISOString(),
                renders_used: 0, // Refill renders on autopay
                autopay_status: "active",
                razorpay_payment_id: payment?.id || subscription.razorpay_payment_id,
                updated_at: now.toISOString()
            })
            .eq("id", subscription.id);

        console.log(`Subscription ${subscription.id} extended until ${newValidUntil.toISOString()}`);
    } catch (error) {
        console.error("Error handling subscription charge:", error);
    }
}

/**
 * Handle subscription cancellation from bank/UPI
 */
async function handleSubscriptionCancelled(rzpSub: any) {
    try {
        const subId = rzpSub.id;

        // Mark autopay as cancelled by bank, but keep subscription active until expiry
        await supabaseAdmin
            .from("user_subscriptions")
            .update({
                autopay_status: "cancelled_by_bank",
                updated_at: new Date().toISOString()
            })
            .eq("razorpay_subscription_id", subId)
            .eq("status", "active");

        console.log(`Autopay for subscription ${subId} marked as cancelled by bank`);
    } catch (error) {
        console.error("Error handling subscription cancellation:", error);
    }
}
