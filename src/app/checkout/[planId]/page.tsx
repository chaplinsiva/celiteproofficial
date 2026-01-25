"use client";

import React, { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Zap, Crown, HardDrive, Video, Loader2, ArrowLeft, ShieldCheck, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
    const router = useRouter();

    useEffect(() => {
        const init = async () => {
            await checkUser();
            await fetchPlan();
        };
        init();
    }, [planId]);

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("Please log in to continue");
            router.push(`/login?returnTo=/checkout/${planId}`);
            return;
        }
        setUserId(user.id);
    };

    const fetchPlan = async () => {
        try {
            const res = await fetch("/api/subscription/plans");
            const data = await res.json();
            if (res.ok) {
                // Find plan in grouped data
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

    const handlePayment = async () => {
        if (!userId || !plan) return;
        setProcessing(true);

        try {
            // Create order
            const orderRes = await fetch("/api/subscription/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planId: plan.id, userId }),
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error);

            // Open Razorpay
            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "CelitePro",
                description: `${plan.name} - ${plan.billing_cycle === "yearly" ? "Annual" : "Monthly"} Plan`,
                order_id: orderData.orderId,
                handler: async function (response: any) {
                    try {
                        const verifyRes = await fetch("/api/subscription/verify-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                orderId: response.razorpay_order_id,
                                paymentId: response.razorpay_payment_id,
                                signature: response.razorpay_signature,
                            }),
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyRes.ok) {
                            toast.success("Subscription activated!");
                            router.push("/dashboard");
                        } else {
                            throw new Error(verifyData.error);
                        }
                    } catch (err) {
                        toast.error(`Verification failed: ${err}`);
                    }
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

    const formatPrice = (paise: number) => {
        return new Intl.NumberFormat("en-IN").format(paise / 100);
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            </main>
        );
    }

    if (!plan) return null;

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-white py-12 px-6">
            <div className="max-w-4xl mx-auto">
                <Link href="/pricing" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-8 group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Plans
                </Link>

                <div className="grid lg:grid-cols-2 gap-12">
                    {/* Left: Summary */}
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">Checkout</h1>
                            <p className="text-gray-400">Review your plan and complete payment securely.</p>
                        </div>

                        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                                    {plan.name === "Basic" ? <Zap /> : plan.name === "Business" ? <Sparkles /> : <Crown />}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">{plan.name} Plan</h3>
                                    <p className="text-sm text-gray-500 capitalize">{plan.billing_cycle} billing</p>
                                </div>
                            </div>

                            <hr className="border-white/5" />

                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-sm text-gray-300">
                                    <Video className="w-4 h-4 text-emerald-400" />
                                    {plan.render_limit ? `${plan.render_limit} HD Video Renders` : "Unlimited HD Renders"}
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-300">
                                    <HardDrive className="w-4 h-4 text-blue-400" />
                                    {plan.storage_limit_gb}GB Cloud Storage
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-300">
                                    <Check className="w-4 h-4 text-indigo-400" />
                                    Commercial usage license
                                </li>
                                <li className="flex items-center gap-3 text-sm text-gray-300">
                                    <Check className="w-4 h-4 text-indigo-400" />
                                    Priority Cloud Processing
                                </li>
                            </ul>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                            <p className="text-xs text-emerald-400/80">
                                Secure encrypted payment via Razorpay. Your data is safe with us.
                            </p>
                        </div>
                    </div>

                    {/* Right: Payment Card */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col h-fit sticky top-24 shadow-2xl">
                        <h3 className="text-lg font-bold mb-6">Payment Summary</h3>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between text-gray-400">
                                <span>{plan.name} Subscription</span>
                                <span>₹{formatPrice(plan.price_total)}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                                <span>Platform Fee</span>
                                <span className="text-emerald-400">Free</span>
                            </div>
                            <hr className="border-white/5" />
                            <div className="flex justify-between text-xl font-bold text-white">
                                <span>Total Amount</span>
                                <span>₹{formatPrice(plan.price_total)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handlePayment}
                            disabled={processing}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {processing ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <CreditCard className="w-5 h-5" />
                            )}
                            {processing ? "Processing..." : `Pay ₹${formatPrice(plan.price_total)} & Subscribe`}
                        </button>

                        <p className="text-[10px] text-gray-500 text-center mt-6">
                            By clicking the button above, you agree to our Terms of Service and Privacy Policy. All payments are securely processed.
                        </p>
                    </div>
                </div>
            </div>

            <script src="https://checkout.razorpay.com/v1/checkout.js" async />
        </main>
    );
}
