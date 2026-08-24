// agent-notes: { ctx: "Subscription logs normalization and filtering utilities for admin panel matching subscription_orders exact schema", deps: [], state: active, last: "sato@2026-08-24" }

export interface RawSubscriptionOrder {
    id: string;
    user_id: string;
    plan_id: string;
    full_name?: string | null;
    company_name?: string | null;
    email?: string | null;
    phone?: string | null;
    razorpay_order_id: string | null;
    razorpay_payment_id?: string | null;
    amount: number;
    currency?: string;
    status: string;
    notes?: any;
    created_at: string;
    updated_at?: string;
}

export interface RawUserSubscription {
    id: string;
    user_id: string;
    plan_id: string;
    status: string;
    autopay_status: string;
    renders_used: number;
    valid_from: string;
    valid_until: string;
    razorpay_order_id?: string | null;
    razorpay_payment_id?: string | null;
    created_at: string;
}

export interface SubscriptionLogEntry {
    id: string;
    sourceType: "order" | "subscription" | "gift";
    userId: string;
    userEmail: string;
    fullName: string | null;
    companyName: string | null;
    phone: string | null;
    planId: string;
    planName: string;
    amount: number;
    currency: string;
    status: string;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    rendersUsed: number;
    renderLimit: number;
    createdAt: string;
    details: string;
}

export function normalizeSubscriptionLogs(
    orders: RawSubscriptionOrder[] = [],
    subscriptions: RawUserSubscription[] = [],
    plansMap: Record<string, { name: string; price_monthly: number; render_limit: number }> = {},
    profilesMap: Record<string, { email: string; full_name?: string | null; phone?: string | null }> = {}
): SubscriptionLogEntry[] {
    const logs: SubscriptionLogEntry[] = [];

    // 1. Process Subscription Orders
    for (const order of orders) {
        const plan = plansMap[order.plan_id] || { name: "Subscription Plan", price_monthly: order.amount, render_limit: 0 };
        const profile = profilesMap[order.user_id];
        const email = order.email || profile?.email || (order.user_id ? `user_${order.user_id.slice(0, 8)}` : "Customer");
        const fullName = order.full_name || profile?.full_name || null;
        const companyName = order.company_name || null;
        const phone = order.phone || profile?.phone || null;

        const isCompleted = order.status === "completed" || order.status === "paid";
        const isFailed = order.status === "failed";
        const isInitialized = order.status === "initialized" || order.status === "created";

        let details = `Order ${order.status} for ${plan.name}`;
        if (fullName) {
            details += ` by ${fullName}`;
        }
        if (order.amount) {
            details += ` (${order.currency === "USD" ? `$${(order.amount / 100).toFixed(2)}` : `₹${(order.amount / 100).toLocaleString("en-IN")}`})`;
        }

        logs.push({
            id: `order-${order.id}`,
            sourceType: "order",
            userId: order.user_id,
            userEmail: email,
            fullName,
            companyName,
            phone,
            planId: order.plan_id,
            planName: plan.name,
            amount: order.amount,
            currency: order.currency || "INR",
            status: isCompleted ? "paid" : isFailed ? "failed" : isInitialized ? "created" : order.status,
            razorpayOrderId: order.razorpay_order_id,
            razorpayPaymentId: order.razorpay_payment_id || null,
            rendersUsed: 0,
            renderLimit: plan.render_limit,
            createdAt: order.created_at,
            details
        });
    }

    // 2. Process Subscriptions (especially Gifts or direct grants)
    for (const sub of subscriptions) {
        const plan = plansMap[sub.plan_id] || { name: "Subscription Plan", price_monthly: 0, render_limit: 0 };
        const profile = profilesMap[sub.user_id];
        const email = profile?.email || (sub.user_id ? `user_${sub.user_id.slice(0, 8)}` : "Customer");
        const fullName = profile?.full_name || null;
        const phone = profile?.phone || null;
        const isGift = plan.name === "Welcome Gift";

        // Check if already covered by an order
        const isLinkedToOrder = orders.some(o => o.razorpay_payment_id && o.razorpay_payment_id === sub.razorpay_payment_id);

        if (!isLinkedToOrder || isGift) {
            logs.push({
                id: `sub-${sub.id}`,
                sourceType: isGift ? "gift" : "subscription",
                userId: sub.user_id,
                userEmail: email,
                fullName,
                companyName: null,
                phone,
                planId: sub.plan_id,
                planName: plan.name,
                amount: plan.price_monthly,
                currency: "INR",
                status: isGift ? "gift" : sub.status,
                razorpayOrderId: sub.razorpay_order_id || null,
                razorpayPaymentId: sub.razorpay_payment_id || null,
                rendersUsed: sub.renders_used,
                renderLimit: plan.render_limit,
                createdAt: sub.created_at,
                details: isGift
                    ? `10 Free HD Credits Welcome Gift claimed`
                    : `Subscription ${sub.status} for ${plan.name} (${sub.renders_used}/${plan.render_limit || "∞"} used)`
            });
        }
    }

    // Sort by created_at descending
    return logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function filterSubscriptionLogs(
    logs: SubscriptionLogEntry[],
    filters: { search?: string; status?: string; plan?: string }
): SubscriptionLogEntry[] {
    const { search, status, plan } = filters;
    const query = search?.trim().toLowerCase() || "";

    return logs.filter((log) => {
        // Status filter
        if (status && status !== "all") {
            if (status === "paid" && !(log.status === "paid" || log.status === "completed" || (log.status === "active" && log.amount > 0))) {
                return false;
            }
            if (status === "gift" && !(log.sourceType === "gift" || log.status === "gift" || log.planName === "Welcome Gift")) {
                return false;
            }
            if (status === "created" && !(log.status === "created" || log.status === "initialized")) {
                return false;
            }
            if (status === "failed" && log.status !== "failed") {
                return false;
            }
        }

        // Plan filter
        if (plan && plan !== "all") {
            if (log.planName.toLowerCase() !== plan.toLowerCase()) {
                return false;
            }
        }

        // Text search
        if (query) {
            const matchesEmail = log.userEmail?.toLowerCase().includes(query);
            const matchesName = log.fullName?.toLowerCase().includes(query);
            const matchesCompany = log.companyName?.toLowerCase().includes(query);
            const matchesPhone = log.phone?.toLowerCase().includes(query);
            const matchesOrderId = log.razorpayOrderId?.toLowerCase().includes(query);
            const matchesPaymentId = log.razorpayPaymentId?.toLowerCase().includes(query);
            const matchesDetails = log.details?.toLowerCase().includes(query);
            const matchesPlan = log.planName?.toLowerCase().includes(query);

            if (
                !matchesEmail &&
                !matchesName &&
                !matchesCompany &&
                !matchesPhone &&
                !matchesOrderId &&
                !matchesPaymentId &&
                !matchesDetails &&
                !matchesPlan
            ) {
                return false;
            }
        }

        return true;
    });
}
