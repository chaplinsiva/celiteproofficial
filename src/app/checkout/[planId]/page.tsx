"use client";

import React, { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Zap, Crown, HardDrive, Video, Loader2, ArrowLeft, ShieldCheck, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Currency, getSavedCurrency, saveCurrency, formatINR, formatUSD } from "@/lib/currency";
import CurrencyToggle from "@/components/CurrencyToggle";

interface Plan {
    id: string;
    name: string;
    billing_cycle: string;
    price_monthly: number;
    price_total: number;
    render_limit: number | null;
    storage_limit_gb: number;
}

export default function CheckoutPage({ params }: { params: Promise<{ planId: string }> }) {
    const { planId } = use(params);
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [currency, setCurrency] = useState<Currency>("INR");

    // Form State
    const [formData, setFormData] = useState({
        fullName: "",
        companyName: "",
        email: "",
        phone: ""
    });

    const router = useRouter();

    useEffect(() => {
        if (typeof window !== "undefined") {
            const urlParams = new URLSearchParams(window.location.search);
            const paramCurrency = urlParams.get("currency") as Currency | null;
            if (paramCurrency === "USD" || paramCurrency === "INR") {
                setCurrency(paramCurrency);
                saveCurrency(paramCurrency);
            } else {
                setCurrency(getSavedCurrency());
            }
        }

        const init = async () => {
            await checkUser();
            await fetchPlan();
        };
        init();
    }, [planId]);

    const handleCurrencyChange = (newCurrency: Currency) => {
        setCurrency(newCurrency);
        saveCurrency(newCurrency);
    };

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("Please log in to continue");
            router.push(`/login?returnTo=/checkout/${planId}`);
            return;
        }
        setUserId(user.id);
        setFormData(prev => ({
            ...prev,
            fullName: user.user_metadata?.full_name || "",
            email: user.email || ""
        }));

        // Fetch and store the session token for API calls
        const { data: { session } } = await supabase.auth.getSession();
        (window as any).__celiteToken = session?.access_token;
    };

    const fetchPlan = async () => {
        try {
            const res = await fetch("/api/subscription/plans");
            const data = await res.json();
            if (res.ok) {
                const allPlans = [...data.grouped.monthly, ...data.grouped.yearly];
                const foundPlan = allPlans.find(p => p.id === planId);
                if (foundPlan) {
                    setPlan(foundPlan);
                } else {
                    toast.error("Plan not found");
                    router.push("/pricing");
                }
            }
        } catch (error) {
            console.error("Failed to fetch plan:", error);
            toast.error("Error loading plan details");
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId || !plan) return;

        if (!formData.fullName || !formData.email || !formData.phone) {
            toast.error("Please fill in all required fields");
            return;
        }

        setProcessing(true);

        try {
            // Create order with user details
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const orderRes = await fetch("/api/subscription/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    planId: plan.id,
                    ...formData
                }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error);

            // Store orderId so it's accessible inside the handler closure
            // even if the user navigates while verifyPayment is in-flight.
            const createdOrderId = orderData.orderId;

            // Open Razorpay
            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "CelitePro",
                description: `${plan.name} - ${plan.billing_cycle === "yearly" ? "Annual" : "Monthly"} Plan`,
                order_id: createdOrderId,
                handler: async function (response: any) {
                    // Redirect to the recovery/confirmation page.
                    // The recovery page calls /api/subscription/recover-payment which
                    // idempotently activates the subscription. The Razorpay webhook is
                    // the server-side safety net if the user closes their browser.
                    //
                    // NOTE: Do NOT also call verify-payment here — calling both
                    // verify-payment AND recover-payment simultaneously was the root
                    // cause of duplicate subscription rows (race condition on insert).
                    router.push(
                        `/payment/recover?orderId=${createdOrderId}&status=success`
                    );
                    setProcessing(false);
                },
                modal: {
                    ondismiss: () => setProcessing(false),
                },
                theme: { color: "#4F46E5" },
            };

            // @ts-ignore
            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (error) {
            console.error("Payment error:", error);
            toast.error(`Failed to initiate payment: ${error}`);
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </main>
        );
    }

    if (!plan) return null;

    return (
        <main className="min-h-screen bg-white text-slate-800 py-12 px-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <Link href="/pricing" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-950 transition-colors group font-medium">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Back to Plans
                    </Link>
                    <CurrencyToggle currency={currency} onChange={handleCurrencyChange} />
                </div>

                <form onSubmit={handlePayment} className="grid lg:grid-cols-2 gap-12">
                    {/* Left: Summary & Form */}
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-3xl font-bold mb-2 text-slate-900">Checkout</h1>
                            <p className="text-slate-500">Review your plan and complete payment securely.</p>
                        </div>

                        {/* Form Section */}
                        <div className="bg-slate-50 border border-slate-205 rounded-3xl p-8 space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                                <span className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">1</span>
                                Contact Details
                            </h3>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.fullName}
                                        onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                                        placeholder="John Doe"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name</label>
                                    <input
                                        type="text"
                                        value={formData.companyName}
                                        onChange={e => setFormData(p => ({ ...p, companyName: e.target.value }))}
                                        placeholder="Acme Inc."
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email ID *</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                        placeholder="john@example.com"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number *</label>
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                        placeholder="+91 9876543210"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-205 rounded-3xl p-8 space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
                                <span className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">2</span>
                                Plan Summary
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                    {plan.name === "Basic" ? <Zap /> : plan.name === "Business" ? <Sparkles /> : <Crown />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{plan.name} Plan</h3>
                                    <p className="text-sm text-slate-500 capitalize">{plan.billing_cycle} billing</p>
                                </div>
                            </div>

                            <hr className="border-slate-200" />

                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-sm text-slate-600">
                                    <Video className="w-4 h-4 text-emerald-600" />
                                    {plan.render_limit ? `${plan.render_limit} HD Video Renders` : "Unlimited HD Renders"}
                                </li>
                                <li className="flex items-center gap-3 text-sm text-slate-600">
                                    <HardDrive className="w-4 h-4 text-blue-600" />
                                    {plan.storage_limit_gb}GB Cloud Storage
                                </li>
                            </ul>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                            <p className="text-xs text-emerald-700 font-medium">
                                Secure encrypted payment via Razorpay. International cards (Visa, Mastercard, Amex) supported.
                            </p>
                        </div>
                    </div>

                    {/* Right: Payment Card */}
                    <div className="bg-slate-50 border border-slate-205 rounded-3xl p-8 flex flex-col h-fit sticky top-24 shadow-lg hover:shadow-xl transition-shadow">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900">Payment Summary</h3>
                            <CurrencyToggle currency={currency} onChange={handleCurrencyChange} showLabel={false} />
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-slate-500">
                                <span>{plan.name} Subscription</span>
                                <span className="font-semibold text-slate-800">
                                    {currency === "USD" ? `$${formatUSD(plan.price_total)}` : `₹${formatINR(plan.price_total)}`}
                                </span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                                <span>Platform Fee</span>
                                <span className="text-emerald-600 font-semibold">Free</span>
                            </div>
                            <hr className="border-slate-200" />
                            <div className="flex justify-between items-baseline text-xl font-bold text-slate-900">
                                <span>Total Amount</span>
                                <div className="text-right">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 text-2xl font-extrabold">
                                        {currency === "USD" ? `$${formatUSD(plan.price_total)}` : `₹${formatINR(plan.price_total)}`}
                                    </span>
                                    {currency === "USD" && (
                                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                                            Charged as ₹{formatINR(plan.price_total)} INR
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 hover:opacity-95 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {processing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <CreditCard className="w-5 h-5" />
                            )}
                            {processing ? "Processing..." : currency === "USD" ? `Pay $${formatUSD(plan.price_total)} & Subscribe` : `Pay ₹${formatINR(plan.price_total)} & Subscribe`}
                        </button>

                        <p className="text-[10px] text-slate-500 text-center mt-6">
                            By clicking the button above, you agree to our Terms of Service and Privacy Policy. All domestic and international payments are securely processed.
                        </p>
                    </div>
                </form>
            </div>

            <script src="https://checkout.razorpay.com/v1/checkout.js" async />
        </main>
    );
}

