"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/jsx-no-target-blank */

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
    Video, Clock, CheckCircle2, AlertCircle,
    Download, ExternalLink, RefreshCw, LogOut,
    Play, Layout, User, Trash2, Settings, HardDrive, Zap, AlertTriangle, Crown
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SubscriptionStatus {
    hasSubscription: boolean;
    isFreeUser: boolean;
    isExpired?: boolean;
    hasExpiredCredits?: boolean;
    expiredCredits?: { remaining: number; planName: string } | null;
    message?: string;
    subscription?: {
        id: string;
        status: string;
        autopayStatus: string;
        validUntil: string;
        rendersUsed: number;
        rendersRemaining: number | null;
        storageUsedGb: string;
        storagePercent: string;
    };
    plan?: {
        name: string;
        billingCycle: string;
        renderLimit: number | null;
        storageLimitGb: number;
    };
    warnings?: {
        storageNearLimit: boolean;
        storageAtLimit: boolean;
        rendersExhausted: boolean;
        autopayIssue: boolean;
        subscriptionExpired?: boolean;
    };
}

interface Project {
    id: string;
    name: string;
    configuration: any;
    created_at: string;
    updated_at: string;
    template: {
        title: string;
        thumbnail_url: string;
        slug: string;
    };
}

interface RenderJob {
    id: string;
    status: "pending" | "processing" | "completed" | "failed";
    output_url: string | null;
    error_message: string | null;
    created_at: string;
    template: {
        title: string;
        thumbnail_url: string;
        slug: string;
    };
}

export default function Dashboard() {
    const [jobs, setJobs] = useState<RenderJob[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState<"projects" | "renders">("projects");
    const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
    const [cancellingSubscription, setCancellingSubscription] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!isMounted) return;

            if (session?.user) {
                setUser(session.user);
                fetchData(session.user, session.access_token);
            } else {
                // Truly unauthenticated — redirect to login
                setLoading(false);
                router.push("/login?redirect=/dashboard");
            }
        };

        checkAuth();

        // Listen for subsequent auth state changes (e.g. SIGNED_IN, SIGNED_OUT).
        // We ignore the initial session lookup here since checkAuth handles it.
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
            (event: any, session: any) => {
                if (!isMounted) return;
                if (event === "SIGNED_IN") {
                    if (session?.user) {
                        setUser(session.user);
                        fetchData(session.user, session.access_token);
                    }
                } else if (event === "SIGNED_OUT") {
                    setUser(null);
                    setLoading(false);
                    router.push("/login");
                }
            }
        );

        return () => {
            isMounted = false;
            authSub.unsubscribe();
        };
    }, []);

    const fetchData = async (authUser: any, token: string) => {
        try {
            // Fetch Renders
            const { data: jobsData, error: jobsError } = await supabase
                .from("render_jobs")
                .select(`
                    *,
                    template:templates (
                        title,
                        thumbnail_url,
                        slug
                    )
                `)
                .eq("user_id", authUser.id)
                .order("created_at", { ascending: false });

            if (jobsError) throw jobsError;
            setJobs(jobsData || []);

            // Fetch Projects
            const projRes = await fetch(`/api/projects`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const projData = await projRes.json();
            if (projRes.ok) {
                setProjects(projData.projects || []);
            }

            // Check if admin
            const { data: adminData } = await supabase
                .from("admins")
                .select("*")
                .eq("user_id", authUser.id)
                .single();

            if (adminData) {
                setIsAdmin(true);
            }

            // Fetch subscription status
            const subRes = await fetch(`/api/subscription/status`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const subData = await subRes.json();
            if (subRes.ok) {
                setSubscription(subData);
            }
        } catch (err) {
            console.error("Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const handleDeleteProject = async (id: string) => {
        if (!confirm("Are you sure you want to delete this project?")) return;

        try {
            const { data: { session: delSession } } = await supabase.auth.getSession();
            const delToken = delSession?.access_token;
            const res = await fetch(`/api/projects/${id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(delToken ? { "Authorization": `Bearer ${delToken}` } : {})
                },
            });
            if (res.ok) {
                setProjects(projects.filter(p => p.id !== id));
                toast.success("Project deleted");
            } else {
                toast.error("Failed to delete project");
            }
        } catch (err) {
            console.error("Delete error:", err);
            toast.error("Error deleting project");
        }
    };

    const handleDownload = async (url: string, jobId: string) => {
        const name = `CelitePro-${jobId}.mp4`;
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

    const handleCancelSubscription = async () => {
        if (!subscription?.subscription?.id || !user) return;
        if (!confirm("Are you sure you want to cancel your subscription? Access will be revoked immediately.")) return;

        setCancellingSubscription(true);
        try {
            const { data: { session: cancelSession } } = await supabase.auth.getSession();
            const cancelToken = cancelSession?.access_token;
            const res = await fetch("/api/subscription/cancel", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(cancelToken ? { "Authorization": `Bearer ${cancelToken}` } : {})
                },
                body: JSON.stringify({
                    subscriptionId: subscription.subscription.id,
                }),
            });

            if (res.ok) {
                toast.success("Subscription cancelled");
                setSubscription({ hasSubscription: false, isFreeUser: true });
            } else {
                toast.error("Failed to cancel subscription");
            }
        } catch (err) {
            console.error("Cancel error:", err);
            toast.error("Error cancelling subscription");
        } finally {
            setCancellingSubscription(false);
        }
    };

    const handleDeleteJob = async (id: string) => {
        if (!confirm("Are you sure you want to delete this render? This will permanently remove the video.")) return;

        try {
            const { data: { session: delJobSession } } = await supabase.auth.getSession();
            const delJobToken = delJobSession?.access_token;
            const res = await fetch(`/api/render/status?jobId=${id}`, {
                method: "DELETE",
                headers: {
                    ...(delJobToken ? { "Authorization": `Bearer ${delJobToken}` } : {})
                }
            });
            if (res.ok) {
                setJobs(jobs.filter(j => j.id !== id));
                toast.success("Render deleted");
            } else {
                toast.error("Failed to delete render");
            }
        } catch (err) {
            console.error("Delete job error:", err);
            toast.error("Error deleting render");
        }
    };

    const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

    const handleRetryJob = async (jobId: string) => {
        if (!user) return;
        setRetryingJobId(jobId);
        try {
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            const retryToken = retrySession?.access_token;
            const res = await fetch("/api/render/retry", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(retryToken ? { "Authorization": `Bearer ${retryToken}` } : {})
                },
                body: JSON.stringify({ jobId }),
            });
            if (res.ok) {
                toast.success("Retry started successfully");
                router.push(`/render/${jobId}`);
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to retry render");
            }
        } catch (err) {
            console.error("Retry error:", err);
            toast.error("Network error while trying to retry");
        } finally {
            setRetryingJobId(null);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "completed": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            case "failed": return <AlertCircle className="w-4 h-4 text-red-400" />;
            case "processing": return <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />;
            default: return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusText = (status: string) => {
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    /**
     * Verify a URL is a Cloudflare R2 CDN URL, not a raw Plainly URL.
     * Plainly URLs are temporary and should never be shown to the user for download.
     * Any job whose output_url doesn't pass this check is treated as still-processing.
     */
    const isCloudflareUrl = (url: string | null): boolean => {
        if (!url) return false;
        const cdnBase = process.env.NEXT_PUBLIC_S3_URL || "";
        // Accept both custom CDN domain and direct R2 storage URL
        return url.startsWith(cdnBase) ||
            url.includes("r2.cloudflarestorage.com") ||
            url.includes("cdn.celite.in") ||
            url.includes("files.celitepro.in");
    };    return (
        <main className="min-h-screen bg-white text-slate-800">
            {/* Navigation / Header */}
            <header className="border-b border-slate-200/60 bg-white/85 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
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

                    <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                        {isAdmin && (
                            <Link href="/admin" className="text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-550 transition-all flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                Admin
                            </Link>
                        )}
                        <Link href="/templates" className="text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                            Templates
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-red-650 transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Log out</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* User Profile Summary */}
                <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-2">My Account</h1>
                        <p className="text-sm md:text-base text-slate-500">Manage your renders and account settings.</p>
                    </div>

                    {user && (
                        <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl w-full md:w-auto">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600/10 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                                {user.user_metadata?.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                )}
                            </div>
                            <div className="min-w-0 text-left">
                                <div className="text-xs md:text-sm font-bold text-slate-900 uppercase tracking-wider truncate">
                                    {user.user_metadata?.full_name || "User Account"}
                                </div>
                                <div className="text-[10px] md:text-xs text-slate-500 truncate">{user.email}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Subscription Status Card */}
                {subscription && (
                    <div className="mb-12 p-6 bg-slate-50 border border-slate-200/60 rounded-2xl">
                        {subscription.hasSubscription && subscription.plan && subscription.subscription ? (
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                                            <Crown className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-slate-900">{subscription.plan.name} Plan</h3>
                                                <span className="text-xs px-2 py-0.5 bg-slate-200/60 rounded text-slate-655 capitalize">
                                                    {subscription.plan.billingCycle}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500">
                                                Valid until {new Date(subscription.subscription.validUntil).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {subscription.subscription.autopayStatus !== "active" && (
                                            <span className="text-xs px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                Autopay Cancelled
                                            </span>
                                        )}
                                        <Link
                                            href="/pricing"
                                            className="text-xs px-4 py-2 bg-white border border-slate-250 rounded-lg hover:bg-slate-100 transition-all text-slate-700 font-semibold"
                                        >
                                            Change Plan
                                        </Link>
                                        <button
                                            onClick={handleCancelSubscription}
                                            disabled={cancellingSubscription}
                                            className="text-xs px-4 py-2 bg-red-50 border border-red-100 text-red-600 rounded-lg hover:bg-red-100 transition-all disabled:opacity-50 font-semibold"
                                        >
                                            {cancellingSubscription ? "Cancelling..." : "Cancel"}
                                        </button>
                                    </div>
                                </div>

                                {/* Expired/Cancelled Warning Banner */}
                                {(subscription.subscription.status !== "active" && subscription.subscription.status !== "trialing") && (
                                     <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                                         <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                         <div>
                                             <h4 className="text-sm font-bold text-red-700 mb-1">Storage Deletion Warning</h4>
                                             <p className="text-xs text-red-600">Your subscription has ended. To prevent your uploads, projects, and generated videos from being permanently deleted in 30 days, please renew your plan.</p>
                                         </div>
                                     </div>
                                )}

                                {/* Progress Bars */}
                                <div className="grid md:grid-cols-2 gap-6 mt-6">
                                    {/* Renders */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <Zap className="w-4 h-4 text-blue-600" />
                                                Credits Used
                                            </span>
                                            <span className="text-slate-800 font-bold">
                                                {subscription.plan.renderLimit
                                                    ? `${subscription.subscription.rendersUsed}/${subscription.plan.renderLimit}`
                                                    : "Unlimited"
                                                }
                                            </span>
                                        </div>
                                        {subscription.plan.renderLimit && (
                                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${subscription.warnings?.rendersExhausted
                                                        ? "bg-red-500"
                                                        : "bg-gradient-to-r from-blue-600 to-indigo-600"
                                                        }`}
                                                    style={{ width: `${Math.min((subscription.subscription.rendersUsed / subscription.plan.renderLimit) * 100, 100)}%` }}
                                                />
                                            </div>
                                        )}
                                        {subscription.warnings?.rendersExhausted && (
                                            <p className="text-xs text-red-650">Credit limit reached. Renews on {new Date(subscription.subscription.validUntil).toLocaleDateString()}</p>
                                        )}
                                    </div>

                                    {/* Storage */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-500 flex items-center gap-2">
                                                <HardDrive className="w-4 h-4 text-purple-600" />
                                                Storage
                                            </span>
                                            <span className="text-slate-800 font-bold">
                                                {subscription.subscription.storageUsedGb}GB / {subscription.plan.storageLimitGb}GB
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${subscription.warnings?.storageAtLimit
                                                    ? "bg-red-500"
                                                    : subscription.warnings?.storageNearLimit
                                                        ? "bg-amber-500"
                                                        : "bg-gradient-to-r from-blue-500 to-cyan-500"
                                                    }`}
                                                style={{ width: `${Math.min(Number(subscription.subscription.storagePercent), 100)}%` }}
                                            />
                                        </div>
                                        {subscription.warnings?.storageAtLimit && (
                                            <p className="text-xs text-red-655 font-medium">Storage full. Delete old files to continue.</p>
                                        )}
                                        {subscription.warnings?.storageNearLimit && !subscription.warnings?.storageAtLimit && (
                                            <p className="text-xs text-amber-700 font-medium">Storage almost full. Consider deleting old files.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                            subscription.hasExpiredCredits
                                                ? "bg-amber-50 border border-amber-100"
                                                : "bg-slate-100 border border-slate-200"
                                        }`}>
                                            {subscription.hasExpiredCredits
                                                ? <Zap className="w-6 h-6 text-amber-600" />
                                                : <Zap className="w-6 h-6 text-slate-400" />}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">
                                                {subscription.hasExpiredCredits
                                                    ? `${subscription.expiredCredits?.planName || "Previous Plan"} · Expired`
                                                    : "Free Plan"}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                {subscription.hasExpiredCredits
                                                    ? "Free plan storage applies · Renew to restore full benefits"
                                                    : "Projects & renders deleted after 3 days."}
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/pricing"
                                        className="px-6 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-550 transition-all shadow-sm flex items-center gap-2"
                                    >
                                        <Crown className="w-4 h-4" />
                                        {subscription.hasExpiredCredits ? "Renew Plan" : "Upgrade Now"}
                                    </Link>
                                </div>

                                {/* Expired credits banner */}
                                {subscription.hasExpiredCredits && subscription.expiredCredits && (
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-800 mb-1">You have remaining render credits!</h4>
                                                    <p className="text-xs text-amber-700">
                                                        Your subscription expired but you still have{" "}
                                                        <span className="font-bold text-slate-900">
                                                            {subscription.expiredCredits.remaining > 0
                                                                ? `${subscription.expiredCredits.remaining} credits`
                                                                : "unlimited credits"}
                                                        </span>{" "}
                                                        remaining. You can still render videos — files are stored under free plan limits (1GB, 3-day retention).
                                                    </p>
                                                </div>
                                            </div>
                                            <Link
                                                href="/templates"
                                                className="shrink-0 px-4 py-2 bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold rounded-lg hover:bg-amber-200 transition-all flex items-center gap-1.5"
                                            >
                                                <Video className="w-3.5 h-3.5" />
                                                Use Credits
                                            </Link>
                                        </div>

                                        {/* Credits progress bar */}
                                        {subscription.expiredCredits.remaining > 0 && (
                                            <div className="mt-4 space-y-1.5">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-amber-600">Credits remaining</span>
                                                    <span className="text-slate-800 font-bold">{subscription.expiredCredits.remaining}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                                                        style={{ width: "100%" }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!subscription.hasExpiredCredits && (
                                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-800 mb-1">Free Tier Limitations</h4>
                                            <p className="text-xs text-amber-700">All projects, media uploads, and free previews are unconditionally deleted 3 days after creation on the Free Plan. Upgrade to retain your files permanently.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Storage Tracker for Free / Expired Users */}
                                <div className="max-w-md space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500 flex items-center gap-2">
                                            <HardDrive className="w-4 h-4 text-purple-600" />
                                            Storage Usage
                                        </span>
                                        <span className="text-slate-800 font-bold">
                                            {subscription.subscription?.storageUsedGb || "0.00"}GB / 1GB
                                        </span>
                                    </div>
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${subscription.warnings?.storageAtLimit
                                                ? "bg-red-500"
                                                : subscription.warnings?.storageNearLimit
                                                    ? "bg-amber-500"
                                                    : "bg-blue-600"
                                                }`}
                                            style={{ width: `${Math.min(Number(subscription.subscription?.storagePercent || 0), 100)}%` }}
                                        />
                                    </div>
                                    {subscription.warnings?.storageAtLimit && (
                                        <p className="text-xs text-red-650 font-medium">Limit reached. Renew for more storage.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex items-center gap-8 border-b border-slate-200/60 mb-12">
                    <button
                        onClick={() => setActiveTab("projects")}
                        className={`pb-4 text-sm font-bold transition-all relative ${activeTab === "projects" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                            }`}
                    >
                        My Projects
                        {activeTab === "projects" && (
                            <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("renders")}
                        className={`pb-4 text-sm font-bold transition-all relative ${activeTab === "renders" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
                            }`}
                    >
                        Render History
                        {activeTab === "renders" && (
                            <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                        )}
                    </button>
                </div>

                {/* Grid Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
                        <h2 className="text-xl font-bold text-slate-900">
                            {activeTab === "projects" ? "Saved Projects" : "Recent Renders"}
                        </h2>
                        <span className="ml-2 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-500 font-mono font-medium">
                            {activeTab === "projects" ? projects.length : jobs.length} total
                        </span>
                    </div>
                    {activeTab === "projects" && (
                        <Link
                            href="/templates"
                            className="text-xs font-bold text-blue-600 hover:text-blue-755 transition-colors flex items-center gap-1"
                        >
                            + New Project
                        </Link>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="aspect-video bg-slate-100 border border-slate-200/60 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : activeTab === "projects" ? (
                    projects.length === 0 ? (
                        <div className="text-center py-24 bg-slate-50/50 border border-slate-200 border-dashed rounded-3xl">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-450">
                                <Layout className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">No projects saved</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mb-8">
                                Save your work in the editor to see it here.
                            </p>
                            <Link
                                href="/templates"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-sm"
                            >
                                <Play className="w-4 h-4 fill-current" />
                                Create a Project
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <AnimatePresence mode="popLayout">
                                {projects.map((project, index) => (
                                    <motion.div
                                        key={project.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        layout
                                        className="group relative bg-slate-50/50 border border-slate-200/70 rounded-2xl overflow-hidden hover:bg-white hover:border-slate-300 hover:shadow-lg transition-all"
                                    >
                                        {/* Thumbnail Area */}
                                        <div className="aspect-video relative overflow-hidden bg-black/50">
                                            {project.template?.thumbnail_url ? (
                                                <img
                                                    src={project.template.thumbnail_url}
                                                    alt={project.name}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <img
                                                        src="https://files.celitepro.in/logos/02.png"
                                                        alt="Logo"
                                                        className="w-12 h-12 opacity-20"
                                                    />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

                                            <div className="absolute top-4 right-4">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded border border-white/10">
                                                    {project.template?.title}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-5">
                                            <h3 className="text-lg font-bold text-slate-850 mb-1 truncate">
                                                {project.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-450 mb-6">
                                                <Clock className="w-3 h-3" />
                                                Updated {new Date(project.updated_at).toLocaleDateString()}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/templates/${project.template.slug}/editor/${project.id}`}
                                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm"
                                                >
                                                    <Layout className="w-3 h-3" />
                                                    Edit Project
                                                </Link>
                                                <Link
                                                    href={`/templates/${project.template.slug}`}
                                                    className="p-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-all"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteProject(project.id)}
                                                    className="p-2.5 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 rounded-lg transition-all"
                                                    title="Delete Project"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )
                ) : (
                    jobs.length === 0 ? (
                        <div className="text-center py-24 bg-slate-50/50 border border-slate-200 border-dashed rounded-3xl">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <img
                                    src="https://files.celitepro.in/logos/02.png"
                                    alt="Logo"
                                    className="w-10 h-10 opacity-30"
                                />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">No renders yet</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mb-8">
                                Render a video to see your history here.
                            </p>
                            <Link
                                href="/templates"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-sm"
                            >
                                <Play className="w-4 h-4 fill-current" />
                                Start Rendering
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <AnimatePresence mode="popLayout">
                                {jobs.map((job, index) => (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        layout
                                        className="group relative bg-slate-50/50 border border-slate-200/70 rounded-2xl overflow-hidden hover:bg-white hover:border-slate-300 hover:shadow-lg transition-all"
                                    >
                                        {/* Thumbnail Area */}
                                        <div className="aspect-video relative overflow-hidden bg-black/50">
                                            {job.template?.thumbnail_url ? (
                                                <img
                                                    src={job.template.thumbnail_url}
                                                    alt={job.template.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <img
                                                        src="https://files.celitepro.in/logos/02.png"
                                                        alt="Logo"
                                                        className="w-12 h-12 opacity-20"
                                                    />
                                                </div>
                                            )}

                                            {/* Overlay with subtle gradient */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

                                            {/* Status Badge */}
                                            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md border border-white/10 rounded-full group">
                                                {getStatusIcon(job.status)}
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
                                                    {getStatusText(job.status)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-5">
                                            <h3 className="text-lg font-bold text-slate-850 mb-1 truncate">
                                                {job.template?.title || "Untitled Project"}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-slate-450 mb-6">
                                                <Clock className="w-3 h-3" />
                                                {new Date(job.created_at).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2">
                                                {job.status === "completed" && isCloudflareUrl(job.output_url) ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleDownload(job.output_url!, job.id)}
                                                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-sm"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            Download Video
                                                        </button>
                                                        <Link
                                                            href={`/render/${job.id}`}
                                                            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-all"
                                                            title="View Render"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDeleteJob(job.id)}
                                                            className="p-2.5 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 rounded-lg transition-all"
                                                            title="Delete Render"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                ) : job.status === "failed" ? (
                                                    <div className="w-full flex flex-row gap-2">
                                                        <button
                                                            onClick={() => handleRetryJob(job.id)}
                                                            disabled={retryingJobId === job.id}
                                                            className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold rounded-lg flex items-center justify-center gap-2 border border-blue-200 disabled:opacity-50 transition-all font-semibold"
                                                        >
                                                            <RefreshCw className={`w-3 h-3 ${retryingJobId === job.id ? "animate-spin" : ""}`} />
                                                            {retryingJobId === job.id ? "Retrying..." : "Retry"}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteJob(job.id)}
                                                            className="p-2.5 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 rounded-lg transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <Link
                                                        href={`/render/${job.id}`}
                                                        className="w-full py-2.5 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-2 animate-pulse"
                                                    >
                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                        Tracking Progress...
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )
                )}
            </div>
        </main>
    );
}

