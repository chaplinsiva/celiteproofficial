import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { getRazorpayInstance } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * POST /api/subscription/cancel
 * Cancels user subscription immediately and Razorpay autopay
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        const body = await request.json();
        const { subscriptionId } = body;

        if (!subscriptionId) {
            return NextResponse.json(
                { error: "subscriptionId is required" },
                { status: 400 }
            );
        }

        // Get the subscription
        const { data: subscription, error: fetchError } = await supabaseAdmin
            .from("user_subscriptions")
            .select("*")
            .eq("id", subscriptionId)
            .eq("user_id", userId)
            .single();

        if (fetchError || !subscription) {
            return NextResponse.json(
                { error: "Subscription not found" },
                { status: 404 }
            );
        }

        // Cancel Razorpay subscription if exists
        if (subscription.razorpay_subscription_id) {
            try {
                const razorpay = await getRazorpayInstance();
                await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id);
            } catch (rzpError) {
                console.error("Razorpay cancellation error:", rzpError);
                // Continue with local cancellation even if Razorpay fails
            }
        }

        // Update subscription: keep status=active so user retains access until valid_until.
        // Only mark autopay as cancelled — the subscription naturally "expires" when valid_until passes.
        const { error: updateError } = await supabaseAdmin
            .from("user_subscriptions")
            .update({
                autopay_status: "cancelled_by_user",
                updated_at: new Date().toISOString(),
            })
            .eq("id", subscriptionId);

        if (updateError) {
            console.error("Subscription update error:", updateError);
            return NextResponse.json(
                { error: "Failed to cancel subscription" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Subscription cancelled successfully",
        });

    } catch (error) {
        console.error("Cancel subscription error:", error);
        return NextResponse.json(
            { error: "Failed to cancel subscription" },
            { status: 500 }
        );
    }
}
