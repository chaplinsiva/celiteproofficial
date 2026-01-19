import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";
import { getRazorpayInstance } from "@/lib/razorpay";

export const dynamic = "force-dynamic";

/**
 * Create Razorpay order for payment
 * POST /api/payment/create-order
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    try {
        const body = await request.json();
        const { templateId, userId, projectId } = body;

        if (!templateId || !userId) {
            return NextResponse.json(
                { error: "templateId and userId are required" },
                { status: 400 }
            );
        }

        // Get template to fetch price
        const { data: template, error: templateError } = await supabaseAdmin
            .from("templates")
            .select("id, title, price")
            .eq("id", templateId)
            .single();

        if (templateError || !template) {
            return NextResponse.json(
                { error: "Template not found" },
                { status: 404 }
            );
        }

        const amount = template.price || 19900; // Default ₹199 in paise

        // Create Razorpay order
        const razorpay = await getRazorpayInstance();
        const order = await razorpay.orders.create({
            amount,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                templateId,
                userId,
                projectId: projectId || "",
                templateTitle: template.title,
            },
        });

        // Store payment record in database
        const { data: payment, error: paymentError } = await supabaseAdmin
            .from("payments")
            .insert({
                user_id: userId,
                template_id: templateId,
                razorpay_order_id: order.id,
                amount,
                currency: "INR",
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
            amount,
            currency: "INR",
            keyId: config?.key_id,
            paymentId: payment.id,
        });

    } catch (error) {
        console.error("Create order error:", error);
        return NextResponse.json(
            { error: "Failed to create order", details: String(error) },
            { status: 500 }
        );
    }
}
