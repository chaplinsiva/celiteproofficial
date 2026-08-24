// agent-notes: { ctx: "API for checking and claiming signup gift 10 free credits", deps: ["src/lib/supabase-admin.ts"], state: active, last: "sato@2026-08-24" }
import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/claim-signup-gift
 * Checks if the authenticated user is eligible to claim their 10 free signup gift credits.
 */
export async function GET(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        // Check profile for signup_gift_claimed flag
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("signup_gift_claimed")
            .eq("id", userId)
            .maybeSingle();

        const hasClaimed = profile?.signup_gift_claimed === true;

        // Check if user already has an active subscription or gift subscription
        const { data: existingSubs } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id, status, plan:subscription_plans(name)")
            .eq("user_id", userId);

        const hasGiftSub = (existingSubs || []).some((s: any) => s.plan?.name === "Welcome Gift");

        const eligible = !hasClaimed && !hasGiftSub;

        return NextResponse.json({
            eligible,
            hasClaimed: hasClaimed || hasGiftSub,
            giftCredits: 10
        });
    } catch (error) {
        console.error("Error checking signup gift eligibility:", error);
        return NextResponse.json(
            { error: "Failed to check gift eligibility" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/user/claim-signup-gift
 * Claims the 10 free credits signup gift for the authenticated user.
 */
export async function POST(request: NextRequest) {
    checkSupabaseConfig();

    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        // Check if already claimed in profiles
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("signup_gift_claimed")
            .eq("id", userId)
            .maybeSingle();

        if (profile?.signup_gift_claimed === true) {
            return NextResponse.json(
                { error: "Signup gift has already been claimed", alreadyClaimed: true },
                { status: 400 }
            );
        }

        // Find or fallback to Welcome Gift plan
        let { data: welcomePlan } = await supabaseAdmin
            .from("subscription_plans")
            .select("*")
            .eq("name", "Welcome Gift")
            .maybeSingle();

        if (!welcomePlan) {
            // Insert if missing
            const { data: newPlan, error: insertPlanError } = await supabaseAdmin
                .from("subscription_plans")
                .insert({
                    name: "Welcome Gift",
                    billing_cycle: "monthly",
                    price_monthly: 0,
                    price_total: 0,
                    render_limit: 10,
                    storage_limit_gb: 1,
                    is_active: false
                })
                .select()
                .single();

            if (insertPlanError) throw insertPlanError;
            welcomePlan = newPlan;
        }

        // Check if user already has an existing welcome gift subscription
        const { data: existingGiftSub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("id")
            .eq("user_id", userId)
            .eq("plan_id", welcomePlan.id)
            .maybeSingle();

        if (existingGiftSub) {
            await supabaseAdmin
                .from("profiles")
                .update({ signup_gift_claimed: true })
                .eq("id", userId);

            return NextResponse.json(
                { error: "Signup gift has already been claimed", alreadyClaimed: true },
                { status: 400 }
            );
        }

        // Create 30-day active welcome subscription with 10 credits
        const validUntil = new Date();
        validUntil.setMonth(validUntil.getMonth() + 1);

        const { data: newSubscription, error: subError } = await supabaseAdmin
            .from("user_subscriptions")
            .insert({
                user_id: userId,
                plan_id: welcomePlan.id,
                status: "active",
                autopay_status: "active",
                renders_used: 0,
                storage_used_bytes: 0,
                valid_from: new Date().toISOString(),
                valid_until: validUntil.toISOString()
            })
            .select()
            .single();

        if (subError) throw subError;

        // Mark profile as claimed
        await supabaseAdmin
            .from("profiles")
            .update({ signup_gift_claimed: true })
            .eq("id", userId);

        return NextResponse.json({
            success: true,
            creditsAwarded: 10,
            subscription: newSubscription,
            message: "Congratulations! 10 free HD render credits have been credited to your account."
        });
    } catch (error) {
        console.error("Error claiming signup gift:", error);
        return NextResponse.json(
            { error: "Failed to claim signup gift", details: String(error) },
            { status: 500 }
        );
    }
}
