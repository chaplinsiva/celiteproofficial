import { NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface Plan {
    id: string;
    billing_cycle: string;
    [key: string]: any;
}

/**
 * GET /api/subscription/plans
 * Returns all active subscription plans
 */
export async function GET() {
    checkSupabaseConfig();

    try {
        const { data: plans, error } = await supabaseAdmin
            .from("subscription_plans")
            .select("*")
            .eq("is_active", true)
            .order("price_total", { ascending: true });

        if (error) {
            console.error("Error fetching plans:", error);
            return NextResponse.json(
                { error: "Failed to fetch subscription plans" },
                { status: 500 }
            );
        }

        // Group by billing cycle
        const monthly = plans?.filter((p: Plan) => p.billing_cycle === "monthly") || [];
        const yearly = plans?.filter((p: Plan) => p.billing_cycle === "yearly") || [];

        return NextResponse.json({
            plans,
            grouped: { monthly, yearly }
        });

    } catch (error) {
        console.error("Plans fetch error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
