import { NextResponse } from "next/server";
import { supabaseAdmin, checkSupabaseConfig } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/payment/config
 * Returns global payment configurations like the single pay amount.
 */
export async function GET() {
    checkSupabaseConfig();

    try {
        const { data: config, error } = await supabaseAdmin
            .from("razorpay_config")
            .select("single_pay_amount")
            .single();

        if (error) {
            console.error("Error fetching payment config:", error);
            // Default to ₹699 (69900 paise)
            return NextResponse.json({ singlePayAmount: 69900 });
        }

        return NextResponse.json({
            singlePayAmount: config.single_pay_amount || 69900,
        });
    } catch (error) {
        console.error("Payment config fetch error:", error);
        return NextResponse.json({ singlePayAmount: 69900 });
    }
}
