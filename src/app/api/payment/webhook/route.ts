import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { getWebhookSecret } from "@/lib/razorpay";
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

        if (signature !== expectedSignature) {
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

            default:
                console.log(`Unhandled webhook event: ${event}`);
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Webhook error:", error);
        return NextResponse.json(
            { error: "Webhook processing failed", details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(payment: any) {
    try {
        const orderId = payment.order_id;
        const paymentId = payment.id;

        // Update payment record
        const { error } = await supabaseAdmin
            .from("payments")
            .update({
                razorpay_payment_id: paymentId,
                status: "paid",
                updated_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", orderId);

        if (error) {
            console.error("Failed to update payment:", error);
        } else {
            console.log(`Payment ${paymentId} marked as paid`);
        }
    } catch (error) {
        console.error("Error handling payment success:", error);
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

        if (error) {
            console.error("Failed to update payment:", error);
        } else {
            console.log(`Payment ${paymentId} marked as failed`);
        }
    } catch (error) {
        console.error("Error handling payment failure:", error);
    }
}
