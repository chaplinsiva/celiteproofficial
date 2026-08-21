"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Zap, Crown, HardDrive, Video, Loader2 } from "lucide-react";
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

export default function PricingPage() {
    const [plans, setPlans] = useState<{ monthly: Plan[]; yearly: Plan[] }>({ monthly: [], yearly: [] });
    const [loading, setLoading] = useState(true);
    const [processingPlan, setProcessingPlan] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [currency, setCurrency] = useState<Currency>("INR");
    const router = useRouter();

    useEffect(() => {
        setCurrency(getSavedCurrency());
        fetchPlans();
        checkUser();
    }, []);

    const handleCurrencyChange = (newCurrency: Currency) => {
        setCurrency(newCurrency);
        saveCurrency(newCurrency);
    };

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id || null);
    };

    const fetchPlans = async () => {
        try {
            const res = await fetch("/api/subscription/plans");
            const data = await res.json();
            if (res.ok) {
                setPlans(data.grouped);
            }
        } catch (error) {
            console.error("Failed to fetch plans:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan: Plan) => {
        if (!userId) {
            toast.error("Please log in to subscribe");
            router.push(`/login?returnTo=/pricing`);
            return;
        }

        router.push(`/checkout/${plan.id}?currency=${currency}`);
    };

    const currentPlans = plans.monthly;

    const getPlanIcon = (name: string) => {
        switch (name) {
            case "Starter": return <Zap className="w-6 h-6" />;
            case "Creator": return <Sparkles className="w-6 h-6" />;
            case "Pro": return <Crown className="w-6 h-6" />;
            default: return <Zap className="w-6 h-6" />;
        }
    };

    const getPlanColor = (name: string) => {
        switch (name) {
            case "Starter": return "from-blue-500 to-cyan-500";
            case "Creator": return "from-indigo-500 to-purple-500";
            case "Pro": return "from-amber-500 to-orange-500";
            default: return "from-gray-500 to-gray-600";
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-white text-slate-800">
            {/* Header */}
            <header className="border-b border-slate-200/60 bg-white/85 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <img
                            src="https://files.celitepro.in/logos/02.png"
                            alt="CelitePro Logo"
                            className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                        />
                        <span className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500">
                            CelitePro
                        </span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <CurrencyToggle currency={currency} onChange={handleCurrencyChange} showLabel={false} />
                        <Link href="/templates" className="text-xs sm:text-sm font-medium text-slate-550 hover:text-slate-900 transition-colors">
                            Browse Templates
                        </Link>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                {/* Hero */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500">
                        Choose Your Plan
                    </h1>
                    <p className="text-slate-500 max-w-2xl mx-auto mb-8">
                        Unlock professional video templates with our credit-based plans.
                        Get more credits to render your videos easily.
                    </p>

                    {/* Central Currency Toggle Switch */}
                    <div className="inline-flex items-center justify-center p-1.5 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-sm">
                        <CurrencyToggle currency={currency} onChange={handleCurrencyChange} />
                    </div>
                </div>

                {/* Plans Grid */}
                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {currentPlans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative bg-slate-50/50 border rounded-3xl overflow-hidden hover:bg-white hover:shadow-xl transition-all duration-300 ${plan.name === "Creator"
                                ? "border-indigo-500/70 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                                : "border-slate-200"
                                }`}
                        >
                            {plan.name === "Creator" && (
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 text-center py-2 text-xs font-bold uppercase tracking-wider text-white">
                                    Most Popular
                                </div>
                            )}

                            <div className={`p-8 ${plan.name === "Creator" ? "pt-14" : ""}`}>
                                {/* Plan Icon */}
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getPlanColor(plan.name)} flex items-center justify-center text-white mb-6`}>
                                    {getPlanIcon(plan.name)}
                                </div>

                                {/* Plan Name */}
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>

                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold text-slate-900">
                                            {currency === "USD" ? `$${formatUSD(plan.price_monthly)}` : `₹${formatINR(plan.price_monthly)}`}
                                        </span>
                                        <span className="text-slate-550">/mo</span>
                                    </div>
                                    {currency === "USD" && (
                                        <p className="text-xs text-slate-400 mt-1 font-medium">
                                            ≈ ₹{formatINR(plan.price_monthly)} INR
                                        </p>
                                    )}
                                </div>

                                {/* Features */}
                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                             <Video className="w-3 h-3 text-emerald-600" />
                                        </div>
                                        <span className="text-slate-600">
                                            {plan.render_limit ? `${plan.render_limit} credits / month` : "Unlimited credits"}
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
                                            <HardDrive className="w-3 h-3 text-blue-600" />
                                        </div>
                                        <span className="text-slate-600">{plan.storage_limit_gb}GB storage</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-indigo-600" />
                                        </div>
                                        <span className="text-slate-600">HD quality exports</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center">
                                            <Sparkles className="w-3 h-3 text-purple-600" />
                                        </div>
                                        <span className="text-slate-600">Unlimited background removals</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-purple-600" />
                                        </div>
                                        <span className="text-slate-600">Priority support</span>
                                    </li>
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => handleSubscribe(plan)}
                                    disabled={processingPlan === plan.id}
                                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${plan.name === "Creator"
                                        ? "bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 hover:opacity-95 text-white shadow-md shadow-indigo-500/10"
                                        : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {processingPlan === plan.id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        `Get ${plan.name}`
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Free Tier Note */}
                <div className="text-center mt-16 p-6 bg-slate-50/80 border border-slate-200 rounded-2xl max-w-2xl mx-auto">
                    <p className="text-slate-500 text-sm">
                        <span className="text-slate-900 font-bold">Free previews & trials available!</span>{" "}
                        Try templates before subscribing. Free users get 3 daily background removals. User projects are automatically deleted after 3 days.
                    </p>
                </div>
            </div>

        </main>
    );
}

