import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPaymentSignature, getRazorpaySecret } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * Verify Razorpay payment
 * POST /api/payment/verify-payment
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const body = await request.json();
        const { orderId, paymentId, signature } = body;

        if (!orderId || !paymentId || !signature) {
            return NextResponse.json(
                { error: "orderId, paymentId, and signature are required" },
                { status: 400 }
            );
        }

        // Get Razorpay secret for verification
        const secret = await getRazorpaySecret();

        // Verify signature
        const isValid = verifyPaymentSignature(orderId, paymentId, signature, secret);

        if (!isValid) {
            // Update payment status to failed
            await supabaseAdmin
                .from("payments")
                .update({ status: "failed" })
                .eq("razorpay_order_id", orderId);

            return NextResponse.json(
                { error: "Invalid payment signature" },
                { status: 400 }
            );
        }

        // Update payment record with payment details
        const { data: payment, error: updateError } = await supabaseAdmin
            .from("payments")
            .update({
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
                status: "paid",
                updated_at: new Date().toISOString(),
            })
            .eq("razorpay_order_id", orderId)
            .select()
            .single();

        if (updateError || !payment) {
            console.error("Failed to update payment:", updateError);
            return NextResponse.json(
                { error: "Failed to update payment record" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            paymentId: payment.id,
            message: "Payment verified successfully",
        });

    } catch (error) {
        console.error("Verify payment error:", error);
        return NextResponse.json(
            { error: "Failed to verify payment", details: String(error) },
            { status: 500 }
        );
    }
}
