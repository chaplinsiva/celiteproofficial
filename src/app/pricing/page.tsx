"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, Zap, Crown, HardDrive, Video, Loader2 } from "lucide-react";
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

export default function PricingPage() {
    const [plans, setPlans] = useState<{ monthly: Plan[]; yearly: Plan[] }>({ monthly: [], yearly: [] });
    const [loading, setLoading] = useState(true);
    const [processingPlan, setProcessingPlan] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        fetchPlans();
        checkUser();
    }, []);

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

        router.push(`/checkout/${plan.id}`);
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

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("en-US").format(price);
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-white">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <img
                            src={`${process.env.NEXT_PUBLIC_S3_URL}/logos/02.png`}
                            alt="CelitePro Logo"
                            className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                        />
                        <span className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            CelitePro
                        </span>
                    </Link>
                    <Link href="/templates" className="text-xs sm:text-sm font-medium text-gray-400 hover:text-white transition-colors">
                        Browse Templates
                    </Link>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
                {/* Hero */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
                        Choose Your Plan
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto mb-10">
                        Unlock professional video templates with our credit-based plans.
                        Get more credits to render your videos easily.
                    </p>
                </div>

                {/* Plans Grid */}
                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {currentPlans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative bg-white/[0.02] border rounded-3xl overflow-hidden ${plan.name === "Creator"
                                ? "border-indigo-500/50 ring-1 ring-indigo-500/20"
                                : "border-white/10"
                                }`}
                        >
                            {plan.name === "Creator" && (
                                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-center py-2 text-xs font-bold uppercase tracking-wider">
                                    Most Popular
                                </div>
                            )}

                            <div className={`p-8 ${plan.name === "Creator" ? "pt-14" : ""}`}>
                                {/* Plan Icon */}
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getPlanColor(plan.name)} flex items-center justify-center text-white mb-6`}>
                                    {getPlanIcon(plan.name)}
                                </div>

                                {/* Plan Name */}
                                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>

                                {/* Price */}
                                <div className="mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-bold">${formatPrice(plan.price_monthly)}</span>
                                        <span className="text-gray-500">/mo</span>
                                    </div>
                                </div>

                                {/* Features */}
                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                            <Video className="w-3 h-3 text-emerald-400" />
                                        </div>
                                        <span className="text-gray-300">
                                            {plan.render_limit ? `${plan.render_limit} credits / month` : "Unlimited credits"}
                                        </span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <HardDrive className="w-3 h-3 text-blue-400" />
                                        </div>
                                        <span className="text-gray-300">{plan.storage_limit_gb}GB storage</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-indigo-400" />
                                        </div>
                                        <span className="text-gray-300">HD quality exports</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <Check className="w-3 h-3 text-purple-400" />
                                        </div>
                                        <span className="text-gray-300">Priority support</span>
                                    </li>
                                </ul>

                                {/* CTA */}
                                <button
                                    onClick={() => handleSubscribe(plan)}
                                    disabled={processingPlan === plan.id}
                                    className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${plan.name === "Creator"
                                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-[0_0_30px_rgba(79,70,229,0.3)]"
                                        : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
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
                <div className="text-center mt-16 p-6 bg-white/[0.02] border border-white/10 rounded-2xl max-w-2xl mx-auto">
                    <p className="text-gray-400 text-sm">
                        <span className="text-white font-semibold">Free previews available!</span>{" "}
                        Try templates before subscribing. Free user projects are automatically deleted after 3 days.
                    </p>
                </div>
            </div>

        </main>
    );
}
