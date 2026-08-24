// agent-notes: { ctx: "Aesthetic colorful pricing page with dynamic subscription plans", deps: ["src/lib/supabase.ts", "src/lib/currency.ts", "src/components/CurrencyToggle.tsx"], state: active, last: "sato@2026-08-24" }
"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Check, Sparkles, Zap, Crown, HardDrive, Video, Loader2,
    Gift, ShieldCheck, Flame, ArrowRight, Star, RefreshCw, Lock
} from "lucide-react";
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

    const getPlanConfig = (name: string) => {
        switch (name) {
            case "Monthly Offer":
            case "Special Offer":
                return {
                    icon: <Gift className="w-6 h-6" />,
                    badge: "Special Monthly Offer",
                    badgeColor: "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white shadow-rose-500/20",
                    glowColor: "from-rose-500/20 via-pink-500/10 to-transparent",
                    borderColor: "border-rose-400/60 ring-2 ring-rose-400/30 shadow-xl shadow-rose-500/10",
                    iconGradient: "from-rose-500 via-pink-500 to-amber-500 text-white shadow-rose-500/30",
                    buttonGradient: "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white shadow-lg shadow-rose-500/25",
                    accentTag: "HOT DEAL",
                    tagBg: "bg-rose-50 text-rose-600 border-rose-200",
                };
            case "Starter":
                return {
                    icon: <Zap className="w-6 h-6" />,
                    badge: "Essential",
                    badgeColor: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/20",
                    glowColor: "from-cyan-500/15 via-blue-500/10 to-transparent",
                    borderColor: "border-cyan-200/80 hover:border-cyan-400/80 hover:shadow-xl hover:shadow-cyan-500/10",
                    iconGradient: "from-cyan-500 to-blue-600 text-white shadow-cyan-500/25",
                    buttonGradient: "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-700 text-white shadow-md shadow-cyan-500/20",
                    accentTag: "POPULAR FOR STARTERS",
                    tagBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
                };
            case "Creator":
                return {
                    icon: <Sparkles className="w-6 h-6" />,
                    badge: "Most Popular",
                    badgeColor: "bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 text-white shadow-indigo-500/30",
                    glowColor: "from-violet-500/25 via-indigo-500/15 to-transparent",
                    borderColor: "border-indigo-400/70 ring-2 ring-indigo-500/30 shadow-2xl shadow-indigo-500/15",
                    iconGradient: "from-violet-600 via-indigo-600 to-pink-600 text-white shadow-indigo-500/30",
                    buttonGradient: "bg-gradient-to-r from-violet-600 via-indigo-600 to-pink-600 hover:brightness-110 text-white shadow-xl shadow-indigo-500/30",
                    accentTag: "BEST VALUE",
                    tagBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
                };
            case "Pro":
                return {
                    icon: <Crown className="w-6 h-6" />,
                    badge: "Power Studio",
                    badgeColor: "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-white shadow-amber-500/30",
                    glowColor: "from-amber-500/20 via-orange-500/10 to-transparent",
                    borderColor: "border-amber-300/80 hover:border-amber-400/80 hover:shadow-xl hover:shadow-amber-500/15",
                    iconGradient: "from-amber-500 via-orange-500 to-yellow-500 text-white shadow-amber-500/25",
                    buttonGradient: "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-600 hover:brightness-110 text-white shadow-lg shadow-amber-500/25",
                    accentTag: "MAXIMUM CREDITS",
                    tagBg: "bg-amber-50 text-amber-700 border-amber-200",
                };
            default:
                return {
                    icon: <Zap className="w-6 h-6" />,
                    badge: "Plan",
                    badgeColor: "bg-slate-800 text-white",
                    glowColor: "from-slate-200/20 to-transparent",
                    borderColor: "border-slate-200 hover:border-slate-300",
                    iconGradient: "from-slate-700 to-slate-900 text-white",
                    buttonGradient: "bg-slate-900 hover:bg-slate-800 text-white",
                    accentTag: "STANDARD",
                    tagBg: "bg-slate-50 text-slate-700 border-slate-200",
                };
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-sm font-medium text-slate-500">Loading plan options...</p>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#FAFAFC] text-slate-800 relative overflow-hidden">
            {/* Ambient Background Glow Elements */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-rose-400/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-indigo-400/15 via-purple-400/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-1/2 left-1/3 w-[600px] h-[600px] bg-gradient-to-br from-amber-300/10 via-cyan-300/10 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

            {/* Header with Radiant Accent Line & Aesthetic Glassmorphism */}
            <header className="sticky top-0 z-50 transition-all">
                {/* Top Iridescent Ambient Light Bar */}
                <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-purple-600 via-indigo-500 to-cyan-500 shadow-sm" />

                <div className="bg-white/80 backdrop-blur-2xl border-b border-slate-200/80 shadow-[0_4px_30px_rgba(79,70,229,0.06)]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="relative p-1 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-rose-500/10 border border-indigo-100 group-hover:border-indigo-300 transition-all shadow-sm">
                                <img
                                    src="https://files.celitepro.in/logos/02.png"
                                    alt="CelitePro Logo"
                                    className="w-8 h-8 sm:w-9 sm:h-9 object-contain group-hover:scale-105 transition-transform"
                                />
                            </div>
                            <div>
                                <span className="text-xl sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-rose-500 tracking-tight block">
                                    CelitePro
                                </span>
                            </div>
                        </Link>

                        <div className="flex items-center gap-3 sm:gap-4">
                            <CurrencyToggle currency={currency} onChange={handleCurrencyChange} showLabel={false} />
                            <Link
                                href="/templates"
                                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 hover:from-indigo-600 hover:to-violet-600 text-white transition-all shadow-md shadow-slate-900/10 hover:shadow-indigo-500/25 hover:scale-[1.02]"
                            >
                                <span>Browse Templates</span>
                                <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
                {/* Hero Header */}
                <div className="text-center mb-14 sm:mb-18 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-500/10 via-indigo-500/10 to-cyan-500/10 border border-indigo-200/60 mb-6 shadow-sm">
                        <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                        <span className="text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r from-rose-600 via-indigo-600 to-cyan-600 uppercase tracking-wider">
                            Transparent & Flexible Pricing
                        </span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-5 tracking-tight text-slate-950">
                        Choose Your Creative{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-indigo-600 to-cyan-600">
                            Superpower
                        </span>
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed mb-8">
                        Unlock cinematic wedding templates, instant background removals, and high-speed renders. Pick the perfect credit tier for your workflow.
                    </p>

                    {/* Central Currency Switch */}
                    <div className="inline-flex items-center justify-center p-1.5 bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-md">
                        <CurrencyToggle currency={currency} onChange={handleCurrencyChange} />
                    </div>
                </div>

                {/* Pricing Grid */}
                <div className={`grid gap-6 sm:gap-8 max-w-7xl mx-auto ${
                    currentPlans.length >= 4
                        ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
                        : currentPlans.length === 3
                        ? "grid-cols-1 md:grid-cols-3"
                        : "grid-cols-1 md:grid-cols-2"
                }`}>
                    {currentPlans.map((plan, index) => {
                        const cfg = getPlanConfig(plan.name);
                        const isOffer = plan.name === "Monthly Offer" || plan.name === "Special Offer";
                        const isPopular = plan.name === "Creator";

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 25 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.08, duration: 0.4 }}
                                className={`relative bg-white rounded-3xl overflow-hidden transition-all duration-300 flex flex-col justify-between border ${cfg.borderColor} hover:-translate-y-1.5 hover:shadow-2xl`}
                            >
                                {/* Top Banner Badge */}
                                {(isOffer || isPopular) && (
                                    <div className={`text-center py-2.5 text-[11px] font-extrabold uppercase tracking-widest ${cfg.badgeColor} shadow-md flex items-center justify-center gap-1.5`}>
                                        {isOffer ? <Flame className="w-3.5 h-3.5 fill-current" /> : <Star className="w-3.5 h-3.5 fill-current" />}
                                        {cfg.badge}
                                    </div>
                                )}

                                <div className={`p-6 sm:p-7 flex-1 flex flex-col justify-between ${!isOffer && !isPopular ? "pt-8" : ""}`}>
                                    <div>
                                        {/* Card Header: Icon & Tag */}
                                        <div className="flex items-center justify-between mb-5">
                                            <div className={`w-13 h-13 rounded-2xl bg-gradient-to-br ${cfg.iconGradient} flex items-center justify-center shadow-lg p-3`}>
                                                {cfg.icon}
                                            </div>
                                            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.tagBg}`}>
                                                {cfg.accentTag}
                                            </span>
                                        </div>

                                        {/* Plan Name */}
                                        <h3 className="text-2xl font-black text-slate-900 mb-1">{plan.name}</h3>
                                        <p className="text-xs text-slate-500 mb-5 font-medium">Billed monthly • Instant activation</p>

                                        {/* Price Section */}
                                        <div className="mb-6 p-4 rounded-2xl bg-slate-50/80 border border-slate-100">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
                                                    {currency === "USD" ? `$${formatUSD(plan.price_monthly)}` : `₹${formatINR(plan.price_monthly)}`}
                                                </span>
                                                <span className="text-slate-500 font-semibold text-sm">/month</span>
                                            </div>
                                            {currency === "USD" && (
                                                <p className="text-[11px] text-slate-400 mt-1 font-medium">
                                                    ≈ ₹{formatINR(plan.price_monthly)} INR
                                                </p>
                                            )}
                                        </div>

                                        {/* Features List */}
                                        <div className="mb-6">
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Included Perks:</p>
                                            <ul className="space-y-3 text-sm">
                                                <li className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
                                                        <Video className="w-3 h-3 text-emerald-600" />
                                                    </div>
                                                    <span className="text-slate-700 font-semibold">
                                                        {plan.render_limit ? `${plan.render_limit} credits / month` : "Unlimited credits"}
                                                    </span>
                                                </li>
                                                <li className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-sky-50 border border-sky-200/80 flex items-center justify-center shrink-0">
                                                        <HardDrive className="w-3 h-3 text-sky-600" />
                                                    </div>
                                                    <span className="text-slate-600 font-medium">{plan.storage_limit_gb}GB Cloud Storage</span>
                                                </li>
                                                <li className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200/80 flex items-center justify-center shrink-0">
                                                        <Check className="w-3 h-3 text-indigo-600" />
                                                    </div>
                                                    <span className="text-slate-600 font-medium">HD Quality Video Exports</span>
                                                </li>
                                                <li className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-fuchsia-50 border border-fuchsia-200/80 flex items-center justify-center shrink-0">
                                                        <Sparkles className="w-3 h-3 text-fuchsia-600" />
                                                    </div>
                                                    <span className="text-slate-600 font-medium">Unlimited Background Removals</span>
                                                </li>
                                                <li className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                                                        <Check className="w-3 h-3 text-amber-600" />
                                                    </div>
                                                    <span className="text-slate-600 font-medium">Priority Support</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={() => handleSubscribe(plan)}
                                        disabled={processingPlan === plan.id}
                                        className={`w-full py-4 px-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 group/btn cursor-pointer ${cfg.buttonGradient} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {processingPlan === plan.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <span>Get {plan.name}</span>
                                                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Trust & Guarantee Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-16 sm:mt-24">
                    <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-4 hover:border-emerald-200 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Instant Activation</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Credits and storage limits are added to your account in real-time right after payment.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-4 hover:border-indigo-200 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Bank-Grade 256-Bit SSL</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Encrypted checkout powered by Razorpay. Domestic UPI, Cards & International Visa/Mastercard supported.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-sm flex items-start gap-4 hover:border-rose-200 transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                            <RefreshCw className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm mb-1">Zero Lock-in</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Switch tiers or cancel anytime with one click directly from your account dashboard.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Free Previews Note */}
                <div className="text-center mt-12 p-6 bg-gradient-to-r from-slate-100/80 via-white to-slate-100/80 border border-slate-200 rounded-3xl max-w-2xl mx-auto shadow-sm">
                    <p className="text-slate-600 text-xs sm:text-sm font-medium">
                        <span className="text-slate-950 font-bold">✨ Free previews available on all templates!</span>{" "}
                        Customize text and photos in our live editor before subscribing. Free users get 3 daily AI background removals.
                    </p>
                </div>
            </div>
        </main>
    );
}
