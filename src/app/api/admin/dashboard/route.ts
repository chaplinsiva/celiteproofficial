import { NextResponse } from "next/server";
import { supabaseAdmin, checkSupabaseConfig, verifyAdminRequest } from "@/lib/supabase-admin";
import { getPresignedDownloadUrl, getR2KeyFromUrl } from "@/lib/r2";
import { normalizeSubscriptionLogs } from "@/lib/subscription-logs";

export async function GET(request: Request) {
    try {
        checkSupabaseConfig();

        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        // Fetch all data in parallel using service role (bypasses RLS)
        const [
            profilesResult,
            projectsResult,
            rendersResult,
            totalRendersResult,
            completedResult,
            failedResult,
            subscriptionsResult,
            subscriptionPlansResult,
            paymentsResult,
            entitlementsResult,
            subscriptionOrdersResult,
        ] = await Promise.all([
            supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
            supabaseAdmin.from("projects").select("*", { count: "exact", head: true }),
            supabaseAdmin
                .from("render_jobs")
                .select(`
                    id, status, output_url, thumbnail_urls, created_at, updated_at,
                    is_sample, is_single_pay, error_message, plainly_render_id,
                    user_id, template_id
                `)
                .order("created_at", { ascending: false })
                .limit(1000),
            supabaseAdmin
                .from("render_jobs")
                .select("*", { count: "exact", head: true }),
            supabaseAdmin
                .from("render_jobs")
                .select("*", { count: "exact", head: true })
                .eq("status", "completed"),
            supabaseAdmin
                .from("render_jobs")
                .select("*", { count: "exact", head: true })
                .eq("status", "failed"),
            supabaseAdmin
                .from("user_subscriptions")
                .select(`
                    id, user_id, status, autopay_status, renders_used,
                    valid_from, valid_until, created_at, updated_at, plan_id
                `)
                .order("created_at", { ascending: false }),
            supabaseAdmin
                .from("subscription_plans")
                .select("*")
                .order("price_monthly", { ascending: true }),
            supabaseAdmin
                .from("payments")
                .select("*")
                .order("created_at", { ascending: false }),
            supabaseAdmin
                .from("user_template_entitlements")
                .select("*")
                .order("created_at", { ascending: false }),
            supabaseAdmin
                .from("subscription_orders")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(500),
        ]);

        const renders = rendersResult.data || [];
        const subscriptions = subscriptionsResult.data || [];
        const entitlements = entitlementsResult.data || [];
        const payments = paymentsResult.data || [];
        const subscriptionOrders = subscriptionOrdersResult.data || [];

        // Collect all unique user IDs and template IDs from renders, subscriptions, entitlements, and subscription orders
        const userIds = [
            ...new Set([
                ...renders.map((r: any) => r.user_id),
                ...subscriptions.map((s: any) => s.user_id),
                ...entitlements.map((e: any) => e.user_id),
                ...subscriptionOrders.map((o: any) => o.user_id),
            ].filter(Boolean))
        ];

        const templateIds = [
            ...new Set([
                ...renders.map((r: any) => r.template_id),
                ...entitlements.map((e: any) => e.template_id)
            ].filter(Boolean))
        ];

        const [templatesResult, profilesDataResult, authUsersResult] = await Promise.all([
            templateIds.length > 0
                ? supabaseAdmin.from("templates").select("id, title, thumbnail_url").in("id", templateIds)
                : { data: [] },
            supabaseAdmin.from("profiles").select("id, email, full_name, phone"),
            supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: { users: [] } })),
        ]);

        const templatesMap: Record<string, any> = {};
        (templatesResult.data || []).forEach((t: any) => { templatesMap[t.id] = t; });

        const profilesMap: Record<string, any> = {};

        // 1. Populate from Supabase Auth users
        const authUsers = (authUsersResult as any)?.data?.users || [];
        authUsers.forEach((u: any) => {
            if (u.id) {
                profilesMap[u.id] = {
                    id: u.id,
                    email: u.email || "",
                    full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
                    phone: u.phone || u.user_metadata?.phone || null,
                };
            }
        });

        // 2. Populate / merge from profiles table
        (profilesDataResult.data || []).forEach((p: any) => {
            if (p.id) {
                profilesMap[p.id] = {
                    ...profilesMap[p.id],
                    ...p,
                    email: p.email || profilesMap[p.id]?.email || "",
                };
            }
        });

        // 3. Populate / merge from subscription orders
        subscriptionOrders.forEach((o: any) => {
            if (o.user_id) {
                profilesMap[o.user_id] = {
                    ...profilesMap[o.user_id],
                    id: o.user_id,
                    email: o.email || profilesMap[o.user_id]?.email || "",
                    full_name: o.full_name || profilesMap[o.user_id]?.full_name || null,
                    phone: o.phone || profilesMap[o.user_id]?.phone || null,
                };
            }
        });

        const plansMap: Record<string, any> = {};
        (subscriptionPlansResult.data || []).forEach((p: any) => { plansMap[p.id] = p; });

        // Enrich renders
        const enrichedRenders = await Promise.all(renders.map(async (r: any) => {
            let outputUrl = r.output_url;
            if (outputUrl && (outputUrl.includes("r2.cloudflarestorage.com") || outputUrl.includes("pub-") || outputUrl.includes("cdn.celite.in"))) {
                try {
                    const key = getR2KeyFromUrl(outputUrl);
                    outputUrl = await getPresignedDownloadUrl(key);
                } catch (e) {
                    console.error(`Failed to generate presigned URL for admin render ${r.id}:`, e);
                }
            }
            const profile = profilesMap[r.user_id];
            const userEmail = profile?.email || (r.user_id ? `user_${r.user_id.slice(0, 8)}` : "Guest");
            return {
                ...r,
                output_url: outputUrl,
                template_title: templatesMap[r.template_id]?.title || "Unknown Template",
                template_thumbnail: templatesMap[r.template_id]?.thumbnail_url || null,
                user_email: userEmail,
            };
        }));

        // Enrich subscriptions
        const enrichedSubscriptions = subscriptions.map((s: any) => {
            const profile = profilesMap[s.user_id];
            const userEmail = profile?.email || (s.user_id ? `user_${s.user_id.slice(0, 8)}` : "Customer");
            return {
                ...s,
                plan_name: plansMap[s.plan_id]?.name || "Unknown Plan",
                billing_cycle: plansMap[s.plan_id]?.billing_cycle || "monthly",
                price_monthly: plansMap[s.plan_id]?.price_monthly || 0,
                price_total: plansMap[s.plan_id]?.price_total || 0,
                render_limit: plansMap[s.plan_id]?.render_limit || 0,
                storage_limit_gb: plansMap[s.plan_id]?.storage_limit_gb || 0,
                user_email: userEmail,
            };
        });

        // Generate comprehensive subscription audit logs
        const subscriptionLogs = normalizeSubscriptionLogs(
            subscriptionOrders,
            subscriptions,
            plansMap,
            profilesMap
        );

        // Map payments by ID and Razorpay Order ID for robust lookups
        const paymentsMapById: Record<string, any> = {};
        const paymentsMapByOrderId: Record<string, any> = {};
        payments.forEach((p: any) => {
            if (p.id) paymentsMapById[p.id] = p;
            if (p.razorpay_order_id) paymentsMapByOrderId[p.razorpay_order_id] = p;
        });

        // Enrich one-time template entitlements (purchases)
        const enrichedEntitlements = entitlements.map((e: any) => {
            const payment = (e.payment_id ? paymentsMapById[e.payment_id] : null) || 
                            (e.razorpay_order_id ? paymentsMapByOrderId[e.razorpay_order_id] : null);
            const profile = profilesMap[e.user_id];
            const userEmail = profile?.email || (e.user_id ? `user_${e.user_id.slice(0, 8)}` : "Customer");
            return {
                ...e,
                template_title: templatesMap[e.template_id]?.title || "Unknown Template",
                user_email: userEmail,
                amount: payment ? payment.amount : 10000, // Default to ₹100 if payment not found
                currency: payment ? payment.currency : "INR",
                payment_status: payment ? payment.status : (e.status === "active" || e.status === "exhausted" ? "paid" : "unknown"),
                razorpay_payment_id: payment ? payment.razorpay_payment_id : null,
            };
        });

        // Deduplicate entitlements by payment_id or razorpay_order_id to prevent double counting
        const seenOrders = new Set<string>();
        const deduplicatedEntitlements: any[] = [];
        enrichedEntitlements.forEach((e: any) => {
            const key = e.payment_id || e.razorpay_order_id;
            if (key) {
                if (!seenOrders.has(key)) {
                    seenOrders.add(key);
                    deduplicatedEntitlements.push(e);
                }
            } else {
                deduplicatedEntitlements.push(e);
            }
        });

        const oneTimePurchasesCount = deduplicatedEntitlements.filter((e: any) => e.payment_status === "paid" || e.payment_status === "completed").length;
        const oneTimeEarnings = deduplicatedEntitlements.filter((e: any) => e.payment_status === "paid" || e.payment_status === "completed").reduce((sum: number, e: any) => sum + e.amount, 0);

        return NextResponse.json({
            stats: {
                totalUsers: profilesResult.count || 0,
                totalProjects: projectsResult.count || 0,
                totalRenders: totalRendersResult.count || 0,
                completedRenders: completedResult.count || 0,
                failedRenders: failedResult.count || 0,
                activeSubscriptions: enrichedSubscriptions.filter((s: any) => s.status === "active").length,
                subscribedUsers: new Set(enrichedSubscriptions.filter((s: any) => s.status === "active").map((s: any) => s.user_id)).size,
                oneTimePurchasesCount,
                oneTimeEarnings,
            },
            renders: enrichedRenders,
            subscriptions: enrichedSubscriptions,
            subscriptionLogs,
            subscriptionOrders,
            oneTimePurchases: deduplicatedEntitlements,
            plans: subscriptionPlansResult.data || [],
            payments: paymentsResult.data || [],
        });
    } catch (err: any) {
        console.error("Admin dashboard API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
