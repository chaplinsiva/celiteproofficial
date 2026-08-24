"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    Loader2, CheckCircle, XCircle, Download,
    ArrowLeft, RefreshCw, Share2, Copy, Check, Sparkles, Clock,
    Server, Cpu, Layers, User
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LoadingFunnyVibes from "@/components/LoadingFunnyVibes";

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
    const [displayProgress, setDisplayProgress] = useState(0);
    const [copied, setCopied] = useState(false);
    const [pollCount, setPollCount] = useState(0);
    const [isTimedOut, setIsTimedOut] = useState(false);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isUnauthenticated, setIsUnauthenticated] = useState(false);
    const router = useRouter();

    // Track when polling started so we know when to surface the stall warning
    const pollStartTime = useRef<number>(Date.now());
    // Store the authenticated user ID upfront so the FIRST poll already sends it
    const currentUserId = useRef<string | null>(null);
    const currentToken = useRef<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!isMounted) return;

                if (session?.user) {
                    currentUserId.current = session.user.id;
                    currentToken.current = session.access_token;
                }
            } catch (err) {
                console.error("Auth init failed on render page:", err);
            } finally {
                if (isMounted) setAuthInitialized(true);
            }
        };

        checkAuth();

        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
            (event: any, session: any) => {
                if (!isMounted) return;
                if (event === "SIGNED_IN" && session?.user) {
                    currentUserId.current = session.user.id;
                    currentToken.current = session.access_token;
                    setAuthInitialized(true);
                }
            }
        );

        return () => {
            isMounted = false;
            authSub.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!authInitialized) return;
        // Reset the poll-start clock when we navigate to a new render
        pollStartTime.current = Date.now();
        setIsTimedOut(false);
        checkStatus();
    }, [renderJobId, authInitialized]);

    useEffect(() => {
        if (!authInitialized) return;
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
    }, [status.status, authInitialized]);

    // Update smooth display progress based on actual states
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (status.status === "processing" || status.status === "pending" || status.status === "sampling") {
            interval = setInterval(() => {
                setDisplayProgress((prev) => {
                    let targetMax = 15;
                    let step = 0.2; // default increment per 100ms tick

                    const plainly = status.plainlyState;
                    if (plainly === "QUEUED" || plainly === "PENDING" || plainly === "THROTTLED") {
                        targetMax = 30;
                        if (prev < 15) step = 1.0; // quickly catch up to stage baseline
                        else step = 0.08; // slow creep in queue
                    } else if (plainly === "IN_PROGRESS") {
                        targetMax = 85;
                        if (prev < 30) step = 1.5; // quickly catch up to rendering baseline
                        else {
                            // Asymptotic curve: slows down as it approaches 85%
                            const remaining = targetMax - prev;
                            step = Math.max(0.02, remaining * 0.005);
                        }
                    } else if (plainly === "DONE") {
                        targetMax = 96;
                        if (prev < 85) step = 2.0; // catch up to saving baseline
                        else step = 0.08; // slow creep while CDN upload finishes
                    } else {
                        // Initializing
                        targetMax = 15;
                        step = 0.3;
                    }

                    if (prev < targetMax) {
                        return Math.min(targetMax, prev + step);
                    }
                    return prev;
                });
            }, 100);
        } else if (status.status === "completed") {
            // Rapid complete sweep on success
            const sweepInterval = setInterval(() => {
                setDisplayProgress((prev) => {
                    if (prev < 100) {
                        return Math.min(100, prev + 4);
                    } else {
                        clearInterval(sweepInterval);
                        return 100;
                    }
                });
            }, 30);
            return () => clearInterval(sweepInterval);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status.status, status.plainlyState]);

    const checkStatus = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || currentToken.current;
            const res = await fetch(`/api/render/status?jobId=${renderJobId}`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                }
            });

            if (res.status === 401) {
                // Not logged in — show authentication screen
                setIsUnauthenticated(true);
                return;
            }

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
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { "Authorization": `Bearer ${token}` } : {})
                    },
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
            url.includes("cdn.celite.in") ||
            url.includes("files.celitepro.in");
    };

    const handleRetry = () => {
        // Reset stall state and resume polling
        pollStartTime.current = Date.now();
        setIsTimedOut(false);
        setPollCount(0);
        setDisplayProgress(0);
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


    const handleDownload = async (url: string, filename?: string) => {
        const name = filename || `CelitePro-${renderJobId}.mp4`;
        
        let tokenParam = "";
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                tokenParam = `&token=${encodeURIComponent(session.access_token)}`;
            }
        } catch (e) {
            console.error("Failed to get session for secure download token:", e);
        }

        const proxyUrl = `/api/render/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(name)}${tokenParam}`;
        const link = document.createElement("a");
        link.href = proxyUrl;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Redirect to pricing when user wants a full HD render from a preview
    const handleUpgradeToHighQuality = () => {
        router.push("/pricing?from=preview");
    };

    const getProgressMessage = () => {
        if (status.plainlyState === "QUEUED" || status.plainlyState === "PENDING" || status.plainlyState === "THROTTLED" || !status.plainlyState) {
            if (pollCount < 3) return "Initializing secure render pipeline...";
            if (pollCount < 8) return "Analyzing template parameters...";
            return "Preparing assets and starting render engine...";
        }
        if (status.plainlyState === "IN_PROGRESS") {
            return "Rendering and compositing your custom video frames...";
        }
        if (status.plainlyState === "DONE") {
            return "Done rendering! Saving video to cloud storage...";
        }
        return "Rendering your custom video — this may take up to 2 minutes...";
    };

    return (
        <main className="min-h-screen bg-white flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full"
            >

                {/* ── Login Required / Unauthenticated State ─────────────────────── */}
                {isUnauthenticated && (
                    <div className="text-center max-w-md mx-auto">
                        <div className="w-24 h-24 mx-auto rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-8 shadow-sm">
                            <User className="w-10 h-10 text-indigo-600" />
                        </div>

                        <h1 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">
                            Authentication Required
                        </h1>
                        <p className="text-sm text-slate-550 mb-10 leading-relaxed">
                            This video belongs to a private CelitePro account. Please log in to view or download it.
                        </p>

                        <div className="flex flex-col gap-4">
                            <Link
                                href={`/login?redirect=/render/${renderJobId}`}
                                className="px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-indigo-500/10 transition-all"
                            >
                                Log In to CelitePro
                            </Link>
                            <Link
                                href="/templates"
                                className="px-6 py-4 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                Browse Templates
                            </Link>
                        </div>
                    </div>
                )}

                {/* ── Processing / Sampling State ─────────────────────────────────── */}
                {!isUnauthenticated && !isTimedOut && (status.status === "processing" || status.status === "pending" || status.status === "sampling") && (
                    <div className="text-center max-w-md mx-auto">
                        {/* Elegant Pulsing Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500 tracking-wider uppercase mb-8">
                            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                            {status.plainlyState === "DONE" ? "Finalizing" : status.plainlyState === "IN_PROGRESS" ? "Rendering" : "Initializing"}
                        </div>

                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">
                            Generating Video
                        </h1>
                        <p className="text-sm text-slate-550 mb-10 min-h-[20px]">
                            {getProgressMessage()}
                        </p>

                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 backdrop-blur-md">
                            {/* Thin Elegant Progress Bar with CSS Eased Transition */}
                            <div className="h-1 bg-slate-200 rounded-full overflow-hidden relative mb-4">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 rounded-full"
                                    style={{
                                        width: `${displayProgress}%`,
                                        transition: "width 0.3s cubic-bezier(0.1, 0.8, 0.25, 1)"
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                                <span>Progress</span>
                                <span className="font-mono text-slate-900 text-sm font-bold">{Math.round(displayProgress)}%</span>
                            </div>

                            {/* Funny Loading GIF with Switch Button */}
                            <LoadingFunnyVibes variant="standard" />
                        </div>

                        <p className="text-xs text-slate-500 mt-12 leading-relaxed max-w-xs mx-auto">
                            This may take a few minutes. You can safely close this page — we will email you when it is ready.
                        </p>
                    </div>
                )}

                {/* ── Stall / Timeout State (still running but not completing) ──────── */}
                {!isUnauthenticated && isTimedOut && (
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-8">
                            <Clock className="w-12 h-12 text-amber-600" />
                        </div>

                        <h1 className="text-3xl font-bold text-slate-900 mb-4">
                            Still Rendering…
                        </h1>
                        <p className="text-slate-500 mb-2">
                            Your render is taking longer than expected.
                        </p>
                        <p className="text-slate-400 text-sm mb-8">
                            Your render credit has <strong className="text-slate-900">not</strong> been deducted — it will only be
                            consumed once the video is fully ready.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={handleRetry}
                                className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Check Again
                            </button>
                            <Link
                                href="/templates"
                                className="flex-1 px-6 py-4 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Templates
                            </Link>
                        </div>
                    </div>
                )}

                {/* ── Completed State ───────────────────────────────────────────────── */}
                {!isUnauthenticated && status.status === "completed" && status.outputUrl && isCloudflareUrl(status.outputUrl) && (
                    <div className="text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 mx-auto rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-8"
                        >
                            <CheckCircle className="w-12 h-12 text-emerald-600" />
                        </motion.div>

                        <h1 className="text-3xl font-bold text-slate-900 mb-4">
                            Video Ready!
                        </h1>
                        <p className="text-slate-550 mb-8">
                            Your video has been rendered successfully.
                        </p>

                        {/* Video Preview */}
                        <div className="mb-8 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
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
                                        className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-indigo-500/10 transition-all"
                                    >
                                        <Sparkles className="w-5 h-5" /> Subscribe to Render in HD
                                    </button>
                                    <button
                                        onClick={() => status.outputUrl && handleDownload(status.outputUrl, `CelitePro-Preview-${renderJobId}.mp4`)}
                                        className="px-6 py-4 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download Preview
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => status.outputUrl && handleDownload(status.outputUrl, `CelitePro-${renderJobId}.mp4`)}
                                        className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
                                    >
                                        <Download className="w-5 h-5" />
                                        Download Video
                                    </button>
                                    <button
                                        onClick={copyToClipboard}
                                        className="px-6 py-4 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                                    >
                                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                        {copied ? "Copied!" : "Copy Link"}
                                    </button>
                                </>
                            )}
                        </div>

                        <Link
                            href="/templates"
                            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mt-8 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Create Another Video
                        </Link>
                    </div>
                )}

                {/* ── Failed State ───────────────────────────────────────────────────── */}
                {!isUnauthenticated && status.status === "failed" && (
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-8">
                            <XCircle className="w-12 h-12 text-red-600" />
                        </div>

                        <h1 className="text-3xl font-bold text-slate-900 mb-4">
                            Render Failed
                        </h1>
                        <p className="text-slate-500 mb-2">
                            {status.error || "Something went wrong during rendering."}
                        </p>
                        <p className="text-slate-400 text-sm mb-8">
                            Your render credit has <strong className="text-slate-900">not</strong> been deducted. You can retry for free.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={async () => {
                                    const token = currentToken.current;
                                    if (!token && !currentUserId.current && !status.userId) return;
                                    setIsRetrying(true);
                                    try {
                                        const res = await fetch("/api/render/retry", {
                                            method: "POST",
                                            headers: {
                                                "Content-Type": "application/json",
                                                ...(token ? { "Authorization": `Bearer ${token}` } : {})
                                            },
                                            body: JSON.stringify({ jobId: renderJobId }),
                                        });
                                        if (res.ok) {
                                            // Reset UI to polling state
                                            pollStartTime.current = Date.now();
                                            setIsTimedOut(false);
                                            setPollCount(0);
                                            setDisplayProgress(0);
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
                                className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 hover:opacity-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                            >
                                {isRetrying ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Retrying...</>
                                ) : (
                                    <><RefreshCw className="w-5 h-5" /> Retry Render</>
                                )}
                            </button>
                            <Link
                                href="/templates"
                                className="flex-1 px-6 py-4 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
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
