"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, Loader2, AlertTriangle, ShieldCheck, Crown, ArrowRight } from "lucide-react";
import Link from "next/link";

type Status = "checking" | "activating" | "success" | "already_active" | "pending" | "error" | "no_order";

interface SubscriptionInfo {
    id?: string;
    validUntil?: string;
    planName?: string;
    billingCycle?: string;
}

function PaymentRecoverPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const orderId = searchParams.get("orderId");
    const isSuccess = searchParams.get("status") === "success"; // came from successful handler redirect

    const [status, setStatus] = useState<Status>("checking");
    const [errorMessage, setErrorMessage] = useState("");
    const [subscription, setSubscription] = useState<SubscriptionInfo>({});
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        if (!orderId) {
            // No orderId — just check subscription status directly
            checkAndRedirect();
            return;
        }
        runRecovery();
    }, [orderId]);

    // Auto-redirect countdown after success
    useEffect(() => {
        if (status === "success" || status === "already_active") {
            const timer = setInterval(() => {
                setCountdown(c => {
                    if (c <= 1) {
                        clearInterval(timer);
                        router.push("/dashboard");
                    }
                    return c - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [status]);

    const checkAndRedirect = async () => {
        setStatus("checking");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/login");
                return;
            }
            // No orderId — just poll subscription status
            const res = await fetch("/api/subscription/status", {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const data = await res.json();
            if (data.hasSubscription) {
                setSubscription({
                    planName: data.plan?.name,
                    billingCycle: data.plan?.billingCycle,
                    validUntil: data.subscription?.validUntil,
                });
                setStatus("already_active");
            } else {
                setStatus("no_order");
            }
        } catch {
            setStatus("no_order");
        }
    };

    const runRecovery = async () => {
        setStatus("checking");
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push(`/login?returnTo=/payment/recover?orderId=${orderId}`);
                return;
            }

            setStatus("activating");

            const res = await fetch("/api/subscription/recover-payment", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ orderId }),
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorMessage(data.error || "Something went wrong. Please contact support.");
                setStatus("error");
                return;
            }

            if (data.pending) {
                setStatus("pending");
                return;
            }

            setSubscription(data.subscription || {});

            if (data.alreadyActive) {
                setStatus("already_active");
            } else {
                setStatus("success");
            }

        } catch (err) {
            setErrorMessage("Network error. Please check your connection and try again.");
            setStatus("error");
        }
    };

    const formattedDate = subscription.validUntil
        ? new Date(subscription.validUntil).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
        })
        : null;

    return (
        <main className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
            <div className="max-w-md w-full">

                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
                            <Crown className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-slate-900">CelitePro</span>
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">

                    {/* Checking / Activating */}
                    {(status === "checking" || status === "activating") && (
                        <div className="p-10 text-center">
                            <div className="relative inline-flex mb-6">
                                <div className="w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center">
                                    <Loader2 className="w-9 h-9 text-indigo-600 animate-spin" />
                                </div>
                                {/* Pulsing ring */}
                                <span className="absolute inset-0 rounded-full border-2 border-indigo-300 animate-ping opacity-30" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                {status === "checking" ? "Checking your payment…" : "Activating subscription…"}
                            </h1>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                {status === "checking"
                                    ? "We're verifying your payment with Razorpay. This only takes a moment."
                                    : "Your payment was confirmed. We're setting up your subscription now."}
                            </p>
                            <div className="mt-6 flex items-center justify-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <span className="text-xs text-slate-400 font-medium">Secured by Razorpay</span>
                            </div>
                        </div>
                    )}

                    {/* Success */}
                    {(status === "success" || status === "already_active") && (
                        <div className="p-10 text-center">
                            <div className="relative inline-flex mb-6">
                                <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                </div>
                                <span className="absolute inset-0 rounded-full border-2 border-emerald-300 animate-ping opacity-20" />
                            </div>
                            <div className="inline-block bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 mb-4">
                                {status === "success" ? "✅ Subscription Activated!" : "✅ Already Active"}
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">
                                Welcome to {subscription.planName ? `${subscription.planName} Plan` : "Premium"}!
                            </h1>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                Your account is now fully upgraded. All premium features are unlocked and ready to use.
                            </p>

                            {formattedDate && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 text-left">
                                    <div className="flex justify-between items-center text-sm mb-2">
                                        <span className="text-slate-500 font-medium">Plan</span>
                                        <span className="text-slate-800 font-semibold capitalize">
                                            {subscription.planName} · {subscription.billingCycle}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 font-medium">Active until</span>
                                        <span className="text-slate-800 font-semibold">{formattedDate}</span>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => router.push("/dashboard")}
                                className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-opacity"
                            >
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <p className="text-xs text-slate-400 mt-3">
                                Redirecting automatically in {countdown}s…
                            </p>
                        </div>
                    )}

                    {/* Pending */}
                    {status === "pending" && (
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mx-auto mb-6">
                                <Loader2 className="w-9 h-9 text-amber-500 animate-spin" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Processing</h1>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                Your payment is being confirmed by Razorpay. This usually takes 30–60 seconds. Please don't close this page.
                            </p>
                            <button
                                onClick={runRecovery}
                                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-colors"
                            >
                                Check Again
                            </button>
                            <p className="text-xs text-slate-400 mt-4">
                                If this persists after 5 minutes, please{" "}
                                <Link href="/contact" className="text-indigo-600 underline">contact support</Link>{" "}
                                with your payment reference.
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {status === "error" && (
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-9 h-9 text-rose-500" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something Went Wrong</h1>
                            <p className="text-slate-500 text-sm leading-relaxed mb-2">
                                {errorMessage}
                            </p>
                            {orderId && (
                                <p className="text-xs text-slate-400 mb-6 font-mono bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                    Order: {orderId}
                                </p>
                            )}
                            <div className="space-y-3">
                                <button
                                    onClick={runRecovery}
                                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:opacity-95 transition-opacity"
                                >
                                    Try Again
                                </button>
                                <Link
                                    href="/dashboard"
                                    className="block w-full py-3.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-center"
                                >
                                    Go to Dashboard
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* No Order */}
                    {status === "no_order" && (
                        <div className="p-10 text-center">
                            <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center mx-auto mb-6">
                                <ShieldCheck className="w-9 h-9 text-slate-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">No Active Subscription Found</h1>
                            <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                We couldn't find an active subscription linked to your account. If you recently paid, please wait a few minutes and try again.
                            </p>
                            <div className="space-y-3">
                                <Link
                                    href="/pricing"
                                    className="block w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl text-center hover:opacity-95 transition-opacity"
                                >
                                    View Plans
                                </Link>
                                <Link
                                    href="/dashboard"
                                    className="block w-full py-3.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors text-center"
                                >
                                    Go to Dashboard
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <p className="text-center text-xs text-slate-400 mt-6">
                    Your payment is protected by Razorpay's 256-bit encryption.{" "}
                    If you need help,{" "}
                    <Link href="/contact" className="text-indigo-500 hover:underline">
                        contact our support team
                    </Link>.
                </p>
            </div>
        </main>
    );
}

export default function PaymentRecoverPageWrapper() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-white flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </main>
            }
        >
            <PaymentRecoverPage />
        </Suspense>
    );
}
