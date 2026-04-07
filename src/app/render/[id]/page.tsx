"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    Loader2, CheckCircle, XCircle, Download,
    ArrowLeft, RefreshCw, Share2, Copy, Check, Sparkles, Clock
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface RenderStatus {
    status: "pending" | "processing" | "completed" | "failed" | "sampling";
    outputUrl?: string;
    error?: string;
    plainlyState?: string;
    message?: string;
    isSample?: boolean;
    isSinglePay?: boolean;
    singlePayExpiresAt?: string;
    templateId?: string;
    projectId?: string;
    userId?: string;
}

// Maximum time to show "Rendering..." before surfacing a stall message (10 minutes)
const MAX_POLL_DURATION_MS = 10 * 60 * 1000;

export default function RenderPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { id: renderJobId } = resolvedParams;

    const [status, setStatus] = useState<RenderStatus>({ status: "processing" });
    const [copied, setCopied] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const router = useRouter();

    // Track when polling started so we know when to surface the stall warning
    const pollStartTime = useRef<number>(Date.now());
    // Store the authenticated user ID upfront so the FIRST poll already sends it
    const currentUserId = useRef<string | null>(null);

    useEffect(() => {
        // Fetch authenticated user on mount so we can send userId with every poll
        (async () => {
            const { data } = await supabase.auth.getUser();
            currentUserId.current = data.user?.id ?? null;
        })();
    }, []);

    useEffect(() => {
        // Reset the poll-start clock when we navigate to a new render
        pollStartTime.current = Date.now();
        setIsTimedOut(false);
        checkStatus();
    }, [renderJobId]);

    useEffect(() => {
        if (status.status === "processing" || status.status === "pending" || status.status === "sampling") {
            const interval = setInterval(() => {
                // Check for stall: if we've been polling for > MAX_POLL_DURATION_MS without
                // completion, stop polling and show the user a helpful stall message.
                const elapsed = Date.now() - pollStartTime.current;
                if (elapsed >= MAX_POLL_DURATION_MS) {
                    setIsTimedOut(true);
                    clearInterval(interval);
                    return;
                }

                checkStatus();
                setPollCount((c) => c + 1);
            }, 1500); // Poll every 1.5 seconds

            return () => clearInterval(interval);
        }
    }, [status.status]);

    const checkStatus = async () => {
        try {
            // Always send the authenticated userId with every poll (even the first one)
            // so the API can enforce ownership from the very start.
            // Falls back to the userId from the last API response if auth fetch is still pending.
            const uid = currentUserId.current || status.userId || null;
            const userIdParam = uid ? `&userId=${uid}` : "";
            const res = await fetch(`/api/render/status?jobId=${renderJobId}${userIdParam}`);

            if (res.status === 403) {
                // Ownership mismatch — stop polling, show error
                setStatus({ status: "failed", error: "You are not authorised to view this render." });
                return;
            }

            const data = await res.json();
            setStatus(data);

            // Mark as viewed if completed
            if (res.ok && (data.status === "completed" || data.status === "failed")) {
                fetch("/api/notifications/mark-viewed", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobId: renderJobId })
                }).catch((err: unknown) => console.error("Auto-mark viewed error:", err));
            }
        } catch (error) {
            console.error("Status check error:", error);
        }
    };

    /** Guard: only Cloudflare CDN URLs should ever be shown for download */
    const isCloudflareUrl = (url?: string): boolean => {
        if (!url) return false;
        const cdnBase = process.env.NEXT_PUBLIC_S3_URL || "";
        return url.startsWith(cdnBase) ||
            url.includes("r2.cloudflarestorage.com") ||
            url.includes("cdn.celite.in");
    };

    const handleRetry = () => {
        // Reset stall state and resume polling
        pollStartTime.current = Date.now();
        setIsTimedOut(false);
        setPollCount(0);
        setStatus({ status: "processing" });
        checkStatus();
    };

    const copyToClipboard = () => {
        if (status.outputUrl) {
            navigator.clipboard.writeText(status.outputUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async (url: string, filename?: string) => {
        setIsDownloading(true);
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = blobUrl;
            link.download = filename || `CelitePro-${renderJobId}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Download failed:", err);
            // Fallback: open in new tab
            window.open(url, "_blank");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleUpgradeToHighQuality = async () => {
        if (!status.templateId || !status.projectId || !status.userId) {
            console.error("Missing required data for upgrade");
            return;
        }

        setIsUpgrading(true);

        try {
            const orderRes = await fetch("/api/payment/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateId: status.templateId,
                    userId: status.userId,
                    projectId: status.projectId,
                }),
            });

            const orderData = await orderRes.json();

            if (!orderRes.ok) {
                throw new Error(orderData.error || "Failed to create payment order");
            }

            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "CelitePro",
                description: "High Quality Render",
                order_id: orderData.orderId,
                handler: async function (response: any) {
                    try {
                        const verifyRes = await fetch("/api/payment/verify-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                orderId: response.razorpay_order_id,
                                paymentId: response.razorpay_payment_id,
                                signature: response.razorpay_signature,
                            }),
                        });

                        const verifyData = await verifyRes.json();

                        if (!verifyRes.ok) {
                            throw new Error(verifyData.error || "Payment verification failed");
                        }

                        if (verifyData.renderJobId) {
                            router.push(`/render/${verifyData.renderJobId}`);
                        }
                    } catch (error) {
                        console.error("Post-payment error:", error);
                        setIsUpgrading(false);
                    }
                },
                modal: {
                    ondismiss: function () {
                        setIsUpgrading(false);
                    },
                },
                theme: {
                    color: "#4F46E5",
                },
            };

            // @ts-ignore - Razorpay is loaded via script
            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (error) {
            console.error("Payment error:", error);
            setIsUpgrading(false);
        }
    };

    const getProgressMessage = () => {
        if (status.plainlyState === "QUEUED") return "Queued — waiting for a render slot...";
        if (status.plainlyState === "IN_PROGRESS") return "Rendering your video...";
        if (status.plainlyState === "THROTTLED") return "Render server is busy, will start shortly...";
        if (pollCount < 3) return "Initializing render engine...";
        if (pollCount < 10) return "Uploading template and assets...";
        if (pollCount < 30) return "Processing template layers...";
        return "Rendering your video — this may take a few minutes...";
    };

    return (
        <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full"
            >

                {/* ── Processing / Sampling State ─────────────────────────────────── */}
                {!isTimedOut && (status.status === "processing" || status.status === "pending" || status.status === "sampling") && (
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-3 mb-10">
                            <span className="w-4 h-4 bg-indigo-400 rounded-full animate-dot-1" />
                            <span className="w-4 h-4 bg-indigo-400 rounded-full animate-dot-2" />
                            <span className="w-4 h-4 bg-indigo-400 rounded-full animate-dot-3" />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            Rendering Your Video
                        </h1>
                        <p className="text-gray-400 mb-8">
                            {getProgressMessage()}
                        </p>

                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Status</span>
                                <span className="text-indigo-400 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                                    {status.plainlyState || "Processing"}
                                </span>
                            </div>
                            <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                    animate={{ width: ["0%", "100%"] }}
                                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-gray-600 mt-6">
                            This may take a few minutes. You can leave this page and check back later.
                        </p>
                    </div>
                )}

                {/* ── Stall / Timeout State (still running but not completing) ──────── */}
                {isTimedOut && (
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-8">
                            <Clock className="w-12 h-12 text-amber-400" />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            Still Rendering…
                        </h1>
                        <p className="text-gray-400 mb-2">
                            Your render is taking longer than expected.
                        </p>
                        <p className="text-gray-500 text-sm mb-8">
                            Your render credit has <strong className="text-white">not</strong> been deducted — it will only be
                            consumed once the video is fully ready.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={handleRetry}
                                className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Check Again
                            </button>
                            <Link
                                href="/templates"
                                className="flex-1 px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Templates
                            </Link>
                        </div>
                    </div>
                )}

                {/* ── Completed State ───────────────────────────────────────────────── */}
                {status.status === "completed" && status.outputUrl && isCloudflareUrl(status.outputUrl) && (
                    <div className="text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-8"
                        >
                            <CheckCircle className="w-12 h-12 text-emerald-400" />
                        </motion.div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            Video Ready!
                        </h1>
                        <p className="text-gray-400 mb-8">
                            Your video has been rendered successfully.
                        </p>

                        {/* Video Preview */}
                        <div className="mb-8 rounded-2xl overflow-hidden border border-white/10">
                            <video
                                src={status.outputUrl}
                                className="w-full aspect-video bg-black"
                                controls
                                autoPlay
                                muted
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            {status.isSample ? (
                                <>
                                    <button
                                        onClick={handleUpgradeToHighQuality}
                                        disabled={isUpgrading}
                                        className="flex-1 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50"
                                    >
                                        {isUpgrading ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                                        ) : (
                                            <><Sparkles className="w-5 h-5" /> Render in High Quality - $9</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => status.outputUrl && handleDownload(status.outputUrl, `CelitePro-Preview-${renderJobId}.mp4`)}
                                        disabled={isDownloading}
                                        className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                        {isDownloading ? "Downloading..." : "Download Preview"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => status.outputUrl && handleDownload(status.outputUrl, `CelitePro-${renderJobId}.mp4`)}
                                        disabled={isDownloading}
                                        className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
                                    >
                                        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                        {isDownloading ? "Downloading..." : "Download Video"}
                                    </button>
                                    <button
                                        onClick={copyToClipboard}
                                        className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        {copied ? "Copied!" : "Copy Link"}
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Single-pay 90-day notice */}
                        {status.isSinglePay && status.singlePayExpiresAt && (
                            <p className="text-xs text-amber-400/70 mt-4 text-center">
                                ⏳ This video will be available for download until {new Date(status.singlePayExpiresAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}.
                            </p>
                        )}

                        <Link
                            href="/templates"
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-white mt-8 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Create Another Video
                        </Link>
                    </div>
                )}

                {/* ── Failed State ───────────────────────────────────────────────────── */}
                {status.status === "failed" && (
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-8">
                            <XCircle className="w-12 h-12 text-red-400" />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            Render Failed
                        </h1>
                        <p className="text-gray-400 mb-2">
                            {status.error || "Something went wrong during rendering."}
                        </p>
                        <p className="text-gray-500 text-sm mb-8">
                            Your render credit has <strong className="text-white">not</strong> been deducted. You can retry for free.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={async () => {
                                    const uid = currentUserId.current || status.userId;
                                    if (!uid) return;
                                    setIsRetrying(true);
                                    try {
                                        const res = await fetch("/api/render/retry", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ jobId: renderJobId, userId: uid }),
                                        });
                                        if (res.ok) {
                                            // Reset UI to polling state
                                            pollStartTime.current = Date.now();
                                            setIsTimedOut(false);
                                            setPollCount(0);
                                            setStatus({ status: "processing" });
                                        } else {
                                            const data = await res.json();
                                            setStatus({ status: "failed", error: data.error || "Retry failed. Please try again." });
                                        }
                                    } catch {
                                        setStatus({ status: "failed", error: "Network error. Please check your connection and try again." });
                                    } finally {
                                        setIsRetrying(false);
                                    }
                                }}
                                disabled={isRetrying}
                                className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
                            >
                                {isRetrying ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Retrying...</>
                                ) : (
                                    <><RefreshCw className="w-5 h-5" /> Retry Render</>
                                )}
                            </button>
                            <Link
                                href="/templates"
                                className="flex-1 px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                Browse Templates
                            </Link>
                        </div>
                    </div>
                )}
            </motion.div>
        </main>
    );
}
