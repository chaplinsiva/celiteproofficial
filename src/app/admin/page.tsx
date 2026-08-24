// agent-notes: { ctx: "Admin dashboard page with comprehensive subscription logs, renders, and analytics", deps: ["src/lib/supabase.ts", "src/lib/subscription-logs.ts"], state: active, last: "sato@2026-08-24" }
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
    Layout, Video, Users, BarChart3, ArrowLeft, Clock, CheckCircle2, AlertCircle,
    RefreshCw, ShieldCheck, ExternalLink, Settings, Globe, Play, X,
    CreditCard, Crown, Calendar, Zap, Download, Eye, XCircle, TrendingUp, ChevronDown,
    ChevronLeft, ChevronRight, FileText, Gift, Search, Copy, Check, Filter
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SubscriptionLogEntry, filterSubscriptionLogs } from "@/lib/subscription-logs";

interface RenderJob {
    id: string; user_id?: string; status: string; output_url: string | null; thumbnail_urls: string[] | null;
    created_at: string; updated_at: string; is_sample: boolean; is_single_pay: boolean;
    template_title: string; template_thumbnail: string | null; user_email: string; error_message?: string;
}
interface Subscription {
    id: string; user_id: string; status: string; autopay_status: string; renders_used: number;
    valid_from: string; valid_until: string; created_at: string; plan_name: string;
    billing_cycle: string; price_monthly: number; render_limit: number; user_email: string;
}
interface OneTimePurchase {
    id: string; user_id: string; template_id: string; credits_remaining: number; status: string;
    payment_id: string | null; razorpay_order_id: string | null; razorpay_payment_id: string | null;
    created_at: string; updated_at: string; template_title: string; user_email: string;
    amount: number; currency: string; payment_status: string;
}
interface DashboardData {
    stats: {
        totalUsers: number; totalProjects: number; totalRenders: number; completedRenders: number; failedRenders: number;
        activeSubscriptions: number; subscribedUsers: number; oneTimePurchasesCount: number; oneTimeEarnings: number;
    };
    renders: RenderJob[];
    subscriptions: Subscription[];
    subscriptionLogs?: SubscriptionLogEntry[];
    oneTimePurchases: OneTimePurchase[];
}

function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { icon: any; cls: string }> = {
        completed: { icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
        failed: { icon: XCircle, cls: "text-red-400 bg-red-500/10 border-red-500/20" },
        processing: { icon: RefreshCw, cls: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
        pending: { icon: Clock, cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
        sampling: { icon: Eye, cls: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
        queued: { icon: Clock, cls: "text-gray-400 bg-gray-500/10 border-gray-500/20" },
    };
    const c = cfg[status] || cfg.queued;
    const Icon = c.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${c.cls}`}>
            <Icon className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`} />
            {status}
        </span>
    );
}

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-3xl mx-4" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute -top-10 right-0 p-2 text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
                <video src={url} controls autoPlay className="w-full rounded-2xl shadow-2xl shadow-black/50" />
            </div>
        </div>
    );
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatPrice(p: number) { return "₹" + (p / 100).toLocaleString("en-IN"); }

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [data, setData] = useState<DashboardData | null>(null);
    const [playingVideo, setPlayingVideo] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"renders" | "subscriptions" | "subscriptionLogs" | "oneTime">("renders");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [hdPage, setHdPage] = useState<number>(1);
    const [hdShowAll, setHdShowAll] = useState<boolean>(false);
    const [freePage, setFreePage] = useState<number>(1);
    const [freeShowAll, setFreeShowAll] = useState<boolean>(false);
    const [graphMetric, setGraphMetric] = useState<"earnings" | "count">("earnings");
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Subscription Logs State
    const [subLogSearch, setSubLogSearch] = useState<string>("");
    const [subLogStatus, setSubLogStatus] = useState<string>("all");
    const [subLogPlan, setSubLogPlan] = useState<string>("all");
    const [subLogPage, setSubLogPage] = useState<number>(1);
    const [subLogShowAll, setSubLogShowAll] = useState<boolean>(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const router = useRouter();

    // Prepare chart data for one-time purchases over the last 30 days
    const chartData = React.useMemo(() => {
        if (!data || !data.oneTimePurchases) return [];
        
        const days: { dateStr: string; fullDate: string; count: number; earnings: number; }[] = [];
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            days.push({
                dateStr: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
                fullDate: d.toISOString().split("T")[0],
                count: 0,
                earnings: 0,
            });
        }
        
        data.oneTimePurchases.forEach(p => {
            if (p.payment_status !== "paid" && p.payment_status !== "completed") return;
            const pDate = new Date(p.created_at).toISOString().split("T")[0];
            const dayObj = days.find(d => d.fullDate === pDate);
            if (dayObj) {
                dayObj.count += 1;
                dayObj.earnings += p.amount / 100; // in Rupees
            }
        });
        
        return days;
    }, [data]);

    const maxVal = React.useMemo(() => {
        if (chartData.length === 0) return 10;
        const vals = chartData.map(d => graphMetric === "earnings" ? d.earnings : d.count);
        const max = Math.max(...vals, 0);
        return max === 0 ? 10 : Math.ceil(max * 1.15); // Add headroom
    }, [chartData, graphMetric]);

    const points = React.useMemo(() => {
        if (chartData.length === 0) return [];
        return chartData.map((d, i) => {
            const val = graphMetric === "earnings" ? d.earnings : d.count;
            const x = 60 + (i / 29) * 920;
            const y = 20 + (1 - (val / maxVal)) * 290;
            return { x, y, data: d };
        });
    }, [chartData, graphMetric, maxVal]);

    const pathData = React.useMemo(() => {
        if (points.length === 0) return { line: "", area: "" };
        const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const area = `${line} L ${points[points.length - 1].x} 310 L ${points[0].x} 310 Z`;
        return { line, area };
    }, [points]);

    const gridLines = React.useMemo(() => {
        const lines = [];
        for (let i = 0; i <= 4; i++) {
            const y = 20 + (i / 4) * 290;
            const val = maxVal - (i / 4) * maxVal;
            lines.push({ 
                y, 
                label: graphMetric === "earnings" 
                    ? "₹" + Math.round(val).toLocaleString("en-IN") 
                    : Math.round(val).toString() 
            });
        }
        return lines;
    }, [maxVal, graphMetric]);

    useEffect(() => { checkAdmin(); }, []);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }
        const { data: adminData, error } = await supabase.from("admins").select("*").eq("user_id", user.id).single();
        if (error || !adminData) { toast.error("Access denied. Admin only."); router.push("/dashboard"); return; }
        setIsAdmin(true);
        fetchData();
    };

    const fetchData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch("/api/admin/dashboard", { headers: { Authorization: `Bearer ${session.access_token}` } });
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            setData(json);
        } catch (err) { console.error(err); toast.error("Failed to load admin data"); }
        finally { setLoading(false); }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
    );
    if (!isAdmin || !data) return null;

    const filteredRenders = statusFilter === "all" ? data.renders : data.renders.filter(r => r.status === statusFilter);
    const activeSubscriptions = data.subscriptions.filter(s => s.status === "active" && new Date(s.valid_until) >= new Date());

    const renderCard = (render: RenderJob) => {
        return (
            <div key={render.id} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all group">
                {/* Thumbnail / Video */}
                <div className="relative aspect-video bg-black/40 overflow-hidden">
                    {render.thumbnail_urls?.[0] ? (
                        <img src={render.thumbnail_urls[0]} alt={render.template_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : render.template_thumbnail ? (
                        <img src={render.template_thumbnail} alt={render.template_title} className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center"><Video className="w-10 h-10 text-gray-700" /></div>
                    )}
                    {/* Play button overlay */}
                    {render.output_url && render.status === "completed" && (
                        <button onClick={() => setPlayingVideo(render.output_url!)}
                            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-white/30 transition-colors">
                                <Play className="w-6 h-6 text-white ml-0.5" />
                            </div>
                        </button>
                    )}
                    {/* Status badge */}
                    <div className="absolute top-3 left-3"><StatusBadge status={render.status} /></div>
                    {/* Badges */}
                    <div className="absolute top-3 right-3 flex gap-1.5">
                        {render.is_sample && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20">SAMPLE</span>}
                        {render.is_single_pay && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/20 text-green-400 border border-green-500/20">PAID</span>}
                    </div>
                </div>
                {/* Info */}
                <div className="p-4">
                    <h3 className="text-sm font-bold text-white truncate mb-1">{render.template_title}</h3>
                    <p className="text-[11px] text-gray-500 truncate mb-3">{render.user_email && render.user_email !== "Unknown User" ? render.user_email : `user_${render.user_id?.slice(0, 8)}`}</p>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-600">{formatDate(render.created_at)}</span>
                        <div className="flex items-center gap-1.5">
                            {render.output_url && (
                                <a href={render.output_url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                                    <Download className="w-3.5 h-3.5" />
                                </a>
                            )}
                            <Link href={`/render/${render.id}`} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                                <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            {playingVideo && <VideoModal url={playingVideo} onClose={() => setPlayingVideo(null)} />}

            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <Link href="/dashboard" className="p-1.5 sm:p-2 hover:bg-white/5 rounded-lg transition-colors">
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                        </Link>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-500" />
                            <h1 className="text-base sm:text-xl font-bold text-white">Admin Dashboard</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setLoading(true); fetchData(); }} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                            <RefreshCw className="w-4 h-4 text-gray-400" />
                        </button>
                        <div className="px-2 sm:px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Master Access</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Main Management Controls */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Templates", icon: Layout, desc: "Manage video templates", href: "/admin/templates", bg: "from-blue-500/10 to-indigo-500/10 hover:from-blue-500/15 hover:to-indigo-500/15 text-indigo-400 border-indigo-500/20" },
                        { label: "SEO", icon: Globe, desc: "Site-wide meta tags", href: "/admin/seo", bg: "from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/15 hover:to-teal-500/15 text-emerald-400 border-emerald-500/20" },
                        { label: "Users", icon: Users, desc: "Manage users", href: "/admin/users", bg: "from-purple-500/10 to-pink-500/10 hover:from-purple-500/15 hover:to-pink-500/15 text-purple-400 border-purple-500/20" },
                        { label: "Settings", icon: Settings, desc: "Platform config", href: "/admin/settings", bg: "from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 text-amber-400 border-amber-500/20" },
                    ].map((tool, i) => (
                        <Link key={i} href={tool.href} className={`p-4 bg-gradient-to-br ${tool.bg} border rounded-2xl flex items-center gap-3.5 transition-all duration-300 hover:scale-[1.02] shadow-sm`}>
                            <div className="p-2.5 rounded-xl bg-white/5"><tool.icon className="w-5 h-5" /></div>
                            <div>
                                <div className="text-sm font-extrabold text-white mb-0.5">{tool.label}</div>
                                <div className="text-[10px] text-gray-400 font-medium leading-tight">{tool.desc}</div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-10">
                    {[
                        { label: "Total Renders", value: data.stats.totalRenders, icon: Video, color: "text-blue-400", bg: "bg-blue-500/10" },
                        { label: "Completed", value: data.stats.completedRenders, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                        { label: "Failed", value: data.stats.failedRenders, icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10" },
                        { label: "Projects", value: data.stats.totalProjects, icon: Layout, color: "text-purple-400", bg: "bg-purple-500/10" },
                        { label: "Total Users", value: data.stats.totalUsers, icon: Users, color: "text-orange-400", bg: "bg-orange-500/10" },
                        { label: "Subscribed", value: data.stats.subscribedUsers, icon: Crown, color: "text-indigo-400", bg: "bg-indigo-500/10" },
                        { label: "One-Time Sales", value: data.stats.oneTimePurchasesCount || 0, icon: CreditCard, color: "text-pink-400", bg: "bg-pink-500/10" },
                        { label: "One-Time Rev", value: formatPrice(data.stats.oneTimeEarnings || 0), icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10" },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all flex flex-col justify-between">
                            <div>
                                <div className={`p-2 rounded-xl ${s.bg} ${s.color} w-fit mb-3`}><s.icon className="w-4 h-4" /></div>
                                <div className="text-xl font-bold text-white tracking-tight truncate">{s.value}</div>
                            </div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1 truncate">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 mb-6 bg-white/[0.02] border border-white/5 rounded-xl p-1 w-fit flex-wrap">
                    {(["renders", "subscriptions", "subscriptionLogs", "oneTime"] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-indigo-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"}`}>
                            {tab === "renders" ? (
                                <><Video className="w-4 h-4 inline mr-1.5" />Total Renders</>
                            ) : tab === "subscriptions" ? (
                                <><Crown className="w-4 h-4 inline mr-1.5" />Active Subscriptions</>
                            ) : tab === "subscriptionLogs" ? (
                                <><FileText className="w-4 h-4 inline mr-1.5" />Subscription Logs</>
                            ) : (
                                <><CreditCard className="w-4 h-4 inline mr-1.5" />One-Time Purchases</>
                            )}
                        </button>
                    ))}
                </div>

                {/* Renders Tab */}
                {activeTab === "renders" && (() => {
                    const ITEMS_PER_PAGE = 12;
                    const allHdRenders = filteredRenders.filter(r => !r.is_sample);
                    const totalHdPages = Math.ceil(allHdRenders.length / ITEMS_PER_PAGE) || 1;
                    const currentHdPage = Math.min(hdPage, totalHdPages);
                    const visibleHdRenders = hdShowAll
                        ? allHdRenders
                        : allHdRenders.slice((currentHdPage - 1) * ITEMS_PER_PAGE, currentHdPage * ITEMS_PER_PAGE);

                    const allFreeRenders = filteredRenders.filter(r => r.is_sample);
                    const totalFreePages = Math.ceil(allFreeRenders.length / ITEMS_PER_PAGE) || 1;
                    const currentFreePage = Math.min(freePage, totalFreePages);
                    const visibleFreeRenders = freeShowAll
                        ? allFreeRenders
                        : allFreeRenders.slice((currentFreePage - 1) * ITEMS_PER_PAGE, currentFreePage * ITEMS_PER_PAGE);

                    const resetPagination = () => {
                        setHdPage(1);
                        setHdShowAll(false);
                        setFreePage(1);
                        setFreeShowAll(false);
                    };

                    const renderPaginationBar = (
                        page: number,
                        totalPages: number,
                        totalItems: number,
                        showAll: boolean,
                        setPage: (p: number) => void,
                        setShowAll: (sa: boolean | ((prev: boolean) => boolean)) => void,
                        accent: "amber" | "indigo"
                    ) => {
                        if (totalItems <= ITEMS_PER_PAGE && !showAll) return null;
                        const isAmber = accent === "amber";

                        // Page numbers calculation
                        const pages: (number | "...")[] = [];
                        if (totalPages <= 7) {
                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                            pages.push(1);
                            if (page > 3) pages.push("...");
                            const start = Math.max(2, page - 1);
                            const end = Math.min(totalPages - 1, page + 1);
                            for (let i = start; i <= end; i++) pages.push(i);
                            if (page < totalPages - 2) pages.push("...");
                            pages.push(totalPages);
                        }

                        return (
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
                                <button
                                    onClick={() => setShowAll(prev => !prev)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                        showAll
                                            ? (isAmber ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30")
                                            : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                                    }`}
                                >
                                    {showAll ? "Paginate (12 per page)" : `Show All (${totalItems})`}
                                </button>

                                {!showAll && totalPages > 1 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                            disabled={page === 1}
                                            onClick={() => setPage(page - 1)}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Previous Page"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>

                                        {pages.map((p, idx) => (
                                            typeof p === "number" ? (
                                                <button
                                                    key={idx}
                                                    onClick={() => setPage(p)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                                                        page === p
                                                            ? (isAmber ? "bg-amber-500 text-black font-extrabold" : "bg-indigo-500 text-white font-extrabold")
                                                            : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            ) : (
                                                <span key={idx} className="px-1 text-gray-600 text-xs">...</span>
                                            )
                                        ))}

                                        <button
                                            disabled={page === totalPages}
                                            onClick={() => setPage(page + 1)}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            title="Next Page"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>

                                        <span className="ml-2 text-xs text-gray-500 font-medium">
                                            Page {page} of {totalPages}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    };

                    return (
                        <div>
                            <div className="flex items-center gap-2 mb-6 flex-wrap">
                                {["all", "completed", "processing", "pending", "failed", "sampling"].map(f => (
                                    <button key={f} onClick={() => { setStatusFilter(f); resetPagination(); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all border ${statusFilter === f ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-gray-300"}`}>
                                        {f} {f !== "all" && `(${data.renders.filter(r => r.status === f).length})`}
                                    </button>
                                ))}
                            </div>

                            {/* HD Renders Section (Priority / First) */}
                            <div className="mb-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-transparent p-2 rounded-lg border-l-2 border-amber-500 w-fit pr-6">
                                        <Crown className="w-4 h-4 text-amber-400" />
                                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                                            HD Renders ({allHdRenders.length})
                                        </h2>
                                    </div>
                                    {allHdRenders.length > 0 && (
                                        <span className="text-[11px] font-medium text-gray-500">
                                            {hdShowAll
                                                ? `Showing all ${allHdRenders.length} HD renders`
                                                : `Showing page ${currentHdPage} of ${totalHdPages} (${visibleHdRenders.length} items)`}
                                        </span>
                                    )}
                                </div>
                                {allHdRenders.length === 0 ? (
                                    <div className="text-center py-12 bg-white/[0.01] border border-white/5 rounded-2xl text-gray-600">
                                        <Video className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs">No HD renders found.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {visibleHdRenders.map(renderCard)}
                                        </div>
                                        {renderPaginationBar(
                                            currentHdPage,
                                            totalHdPages,
                                            allHdRenders.length,
                                            hdShowAll,
                                            setHdPage,
                                            setHdShowAll,
                                            "amber"
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Free Renders Section */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500/10 to-transparent p-2 rounded-lg border-l-2 border-indigo-500/50 w-fit pr-6">
                                        <Video className="w-4 h-4 text-indigo-400" />
                                        <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                                            Free Preview Renders ({allFreeRenders.length})
                                        </h2>
                                    </div>
                                    {allFreeRenders.length > 0 && (
                                        <span className="text-[11px] font-medium text-gray-500">
                                            {freeShowAll
                                                ? `Showing all ${allFreeRenders.length} free renders`
                                                : `Showing page ${currentFreePage} of ${totalFreePages} (${visibleFreeRenders.length} items)`}
                                        </span>
                                    )}
                                </div>
                                {allFreeRenders.length === 0 ? (
                                    <div className="text-center py-12 bg-white/[0.01] border border-white/5 rounded-2xl text-gray-600">
                                        <Video className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-xs">No free preview renders found.</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {visibleFreeRenders.map(renderCard)}
                                        </div>
                                        {renderPaginationBar(
                                            currentFreePage,
                                            totalFreePages,
                                            allFreeRenders.length,
                                            freeShowAll,
                                            setFreePage,
                                            setFreeShowAll,
                                            "indigo"
                                        )}
                                    </>
                                )}
                            </div>

                            {filteredRenders.length === 0 && (
                                <div className="text-center py-20 text-gray-600"><Video className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No renders found for this filter.</p></div>
                            )}
                        </div>
                    );
                })()}

                {/* Subscriptions Tab */}
                {activeTab === "subscriptions" && (
                    <div className="space-y-6">
                        {/* Active Subscriptions Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5">
                                <Crown className="w-5 h-5 text-indigo-400 mb-2" />
                                <div className="text-2xl font-bold text-white">{activeSubscriptions.length}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Active Subscriptions</div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5">
                                <CreditCard className="w-5 h-5 text-emerald-400 mb-2" />
                                <div className="text-2xl font-bold text-white">
                                    {formatPrice(activeSubscriptions.reduce((sum, s) => sum + s.price_monthly, 0))}
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Monthly Revenue</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5">
                                <Zap className="w-5 h-5 text-amber-400 mb-2" />
                                <div className="text-2xl font-bold text-white">
                                    {activeSubscriptions.reduce((sum, s) => sum + s.renders_used, 0)}
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Renders Used</div>
                            </div>
                        </div>

                        {/* Subscription List */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.01]">
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">User</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Plan</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Credits Used</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Price</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Valid Until</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Autopay</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {data.subscriptions.map(sub => {
                                            const isExpired = new Date(sub.valid_until) < new Date();
                                            const renderPercent = sub.render_limit > 0 ? Math.min(100, (sub.renders_used / sub.render_limit) * 100) : 0;
                                            const creditsRemaining = sub.render_limit ? sub.render_limit - sub.renders_used : null;
                                            const hasCredits = creditsRemaining === null || creditsRemaining > 0;
                                            return (
                                                <tr key={sub.id} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-5 py-4">
                                                        <span className="text-sm font-semibold text-white">{sub.user_email && sub.user_email !== "Unknown User" ? sub.user_email : `user_${sub.user_id?.slice(0, 8)}`}</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                            <Crown className="w-3 h-3" />{sub.plan_name}
                                                        </span>
                                                        <span className="block text-[10px] text-gray-600 mt-0.5 capitalize">{sub.billing_cycle}</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                            isExpired ? "text-red-400 bg-red-500/10 border-red-500/20" :
                                                            sub.status === "active" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                                                            "text-gray-400 bg-gray-500/10 border-gray-500/20"
                                                        }`}>
                                                            {isExpired ? (hasCredits ? "expired · can render" : "expired") : sub.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="text-sm text-white font-semibold">{sub.renders_used} / {sub.render_limit || "∞"}</div>
                                                        {creditsRemaining !== null && (
                                                            <div className="text-[10px] text-gray-500 mt-0.5">{creditsRemaining > 0 ? `${creditsRemaining} remaining` : "Exhausted"}</div>
                                                        )}
                                                        {sub.render_limit > 0 && (
                                                            <div className="w-24 h-1.5 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all ${renderPercent > 80 ? "bg-red-500" : renderPercent > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                                                    style={{ width: `${renderPercent}%` }} />
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-sm font-bold text-white">{formatPrice(sub.price_monthly)}</span>
                                                        <span className="text-[10px] text-gray-600">/mo</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`text-xs ${isExpired ? "text-red-400" : "text-gray-400"}`}>
                                                            {new Date(sub.valid_until).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`text-xs font-semibold ${sub.autopay_status === "active" ? "text-emerald-400" : "text-red-400"}`}>
                                                            {sub.autopay_status === "active" ? "Active" : "Cancelled"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {data.subscriptions.length === 0 && (
                                <div className="text-center py-16 text-gray-600"><Crown className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No subscriptions yet.</p></div>
                            )}
                        </div>
                    </div>
                )}

                {/* Subscription Logs Tab */}
                {activeTab === "subscriptionLogs" && (() => {
                    const allLogs = data.subscriptionLogs || [];
                    const filteredLogs = filterSubscriptionLogs(allLogs, {
                        search: subLogSearch,
                        status: subLogStatus,
                        plan: subLogPlan,
                    });

                    const totalLogEvents = allLogs.length;
                    const paidEvents = allLogs.filter(l => l.status === "paid" || (l.status === "active" && l.amount > 0)).length;
                    const giftEvents = allLogs.filter(l => l.sourceType === "gift" || l.status === "gift" || l.planName === "Welcome Gift").length;
                    const totalSubRevenue = allLogs
                        .filter(l => l.status === "paid")
                        .reduce((sum, l) => sum + (l.amount || 0), 0);

                    const ITEMS_PER_PAGE = 15;
                    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE) || 1;
                    const currentPage = Math.min(subLogPage, totalPages);
                    const visibleLogs = subLogShowAll
                        ? filteredLogs
                        : filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

                    const handleCopy = (text: string, id: string) => {
                        navigator.clipboard.writeText(text);
                        setCopiedId(id);
                        toast.success("Copied to clipboard");
                        setTimeout(() => setCopiedId(null), 2000);
                    };

                    const uniquePlans = Array.from(new Set(allLogs.map(l => l.planName).filter(Boolean)));

                    return (
                        <div className="space-y-6">
                            {/* Summary Metric Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-2xl p-5">
                                    <FileText className="w-5 h-5 text-indigo-400 mb-2" />
                                    <div className="text-2xl font-bold text-white">{totalLogEvents}</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Total Audit Events</div>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-2" />
                                    <div className="text-2xl font-bold text-white">{paidEvents}</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Paid Subscriptions</div>
                                </div>
                                <div className="bg-gradient-to-br from-rose-500/10 to-amber-500/10 border border-rose-500/20 rounded-2xl p-5">
                                    <Gift className="w-5 h-5 text-rose-400 mb-2" />
                                    <div className="text-2xl font-bold text-white">{giftEvents}</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">10-Credit Welcome Gifts</div>
                                </div>
                                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5">
                                    <Zap className="w-5 h-5 text-amber-400 mb-2" />
                                    <div className="text-2xl font-bold text-white">{formatPrice(totalSubRevenue)}</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Subscription Revenue</div>
                                </div>
                            </div>

                            {/* Search & Filter Controls */}
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                                <div className="relative w-full md:w-80">
                                    <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Search email, order ID, payment ID..."
                                        value={subLogSearch}
                                        onChange={(e) => { setSubLogSearch(e.target.value); setSubLogPage(1); }}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
                                    />
                                    {subLogSearch && (
                                        <button onClick={() => setSubLogSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                                    {/* Status Filter */}
                                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                                        {[
                                            { id: "all", label: "All" },
                                            { id: "paid", label: "Paid" },
                                            { id: "gift", label: "Gifts" },
                                            { id: "created", label: "Created" },
                                            { id: "failed", label: "Failed" },
                                        ].map(f => (
                                            <button
                                                key={f.id}
                                                onClick={() => { setSubLogStatus(f.id); setSubLogPage(1); }}
                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                    subLogStatus === f.id ? "bg-indigo-500 text-white" : "text-gray-400 hover:text-white"
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Plan Filter */}
                                    {uniquePlans.length > 0 && (
                                        <select
                                            value={subLogPlan}
                                            onChange={(e) => { setSubLogPlan(e.target.value); setSubLogPage(1); }}
                                            className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50"
                                        >
                                            <option value="all">All Plans</option>
                                            {uniquePlans.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Logs Data Table */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                                <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Time</th>
                                                <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">User</th>
                                                <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Action / Event</th>
                                                <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Plan</th>
                                                <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Amount</th>
                                                <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Order / Payment ID</th>
                                                <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {visibleLogs.map((log) => {
                                                const isGift = log.sourceType === "gift" || log.status === "gift";
                                                const isPaid = log.status === "paid" || log.status === "active";

                                                return (
                                                    <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                                                        {/* Timestamp */}
                                                        <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-400">
                                                            {formatDate(log.createdAt)}
                                                        </td>

                                                        {/* User */}
                                                        <td className="px-5 py-4">
                                                            <div className="text-sm font-semibold text-white">
                                                                {log.fullName || log.userEmail}
                                                            </div>
                                                            {log.fullName && (
                                                                <div className="text-xs text-gray-400">{log.userEmail}</div>
                                                            )}
                                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500 font-mono">
                                                                {log.phone && <span>📞 {log.phone}</span>}
                                                                {log.companyName && <span className="text-gray-400">🏢 {log.companyName}</span>}
                                                            </div>
                                                            <div className="text-[9px] font-mono text-gray-600 truncate max-w-[140px] mt-0.5">{log.userId}</div>
                                                        </td>

                                                        {/* Details */}
                                                        <td className="px-5 py-4 max-w-xs">
                                                            <div className="flex items-center gap-2">
                                                                {isGift ? (
                                                                    <div className="p-1 rounded bg-rose-500/10 text-rose-400 shrink-0"><Gift className="w-3.5 h-3.5" /></div>
                                                                ) : isPaid ? (
                                                                    <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 shrink-0"><Check className="w-3.5 h-3.5" /></div>
                                                                ) : log.status === "failed" ? (
                                                                    <div className="p-1 rounded bg-red-500/10 text-red-400 shrink-0"><XCircle className="w-3.5 h-3.5" /></div>
                                                                ) : (
                                                                    <div className="p-1 rounded bg-blue-500/10 text-blue-400 shrink-0"><Clock className="w-3.5 h-3.5" /></div>
                                                                )}
                                                                <span className="text-xs text-gray-300 font-medium">{log.details}</span>
                                                            </div>
                                                        </td>

                                                        {/* Plan */}
                                                        <td className="px-5 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                                                isGift
                                                                    ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                                    : log.planName === "Pro"
                                                                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                                    : log.planName === "Creator"
                                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                                            }`}>
                                                                {isGift ? <Gift className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                                                                {log.planName}
                                                            </span>
                                                            {log.renderLimit > 0 && (
                                                                <span className="block text-[10px] text-gray-500 mt-0.5">{log.renderLimit} Credits</span>
                                                            )}
                                                        </td>

                                                        {/* Amount */}
                                                        <td className="px-5 py-4 whitespace-nowrap">
                                                            {isGift || log.amount === 0 ? (
                                                                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">FREE GIFT</span>
                                                            ) : (
                                                                <span className="text-sm font-bold text-white">
                                                                    {log.currency === "USD" ? `$${(log.amount / 100).toFixed(2)}` : formatPrice(log.amount)}
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Order / Payment ID */}
                                                        <td className="px-5 py-4 whitespace-nowrap">
                                                            {log.razorpayOrderId && (
                                                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-300">
                                                                    <span className="text-gray-500">Order:</span>
                                                                    <span className="truncate max-w-[110px]">{log.razorpayOrderId}</span>
                                                                    <button
                                                                        onClick={() => handleCopy(log.razorpayOrderId!, `order-${log.id}`)}
                                                                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                                                        title="Copy Order ID"
                                                                    >
                                                                        {copiedId === `order-${log.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {log.razorpayPaymentId && (
                                                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 mt-0.5">
                                                                    <span className="text-gray-500">Pay:</span>
                                                                    <span className="truncate max-w-[110px]">{log.razorpayPaymentId}</span>
                                                                    <button
                                                                        onClick={() => handleCopy(log.razorpayPaymentId!, `pay-${log.id}`)}
                                                                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                                                        title="Copy Payment ID"
                                                                    >
                                                                        {copiedId === `pay-${log.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {!log.razorpayOrderId && !log.razorpayPaymentId && (
                                                                <span className="text-xs text-gray-600">—</span>
                                                            )}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="px-5 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                                isGift
                                                                    ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                                                    : log.status === "paid" || log.status === "completed" || log.status === "active"
                                                                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                                                    : log.status === "created" || log.status === "initialized"
                                                                    ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
                                                                    : "text-red-400 bg-red-500/10 border-red-500/20"
                                                            }`}>
                                                                {isGift ? <Gift className="w-3 h-3" /> : (log.status === "paid" || log.status === "completed" || log.status === "active") ? <CheckCircle2 className="w-3 h-3" /> : log.status === "failed" ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                                {isGift ? "Gift Granted" : log.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredLogs.length === 0 && (
                                    <div className="text-center py-16 text-gray-600">
                                        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">No subscription logs matching criteria.</p>
                                    </div>
                                )}
                            </div>

                            {/* Pagination */}
                            {filteredLogs.length > ITEMS_PER_PAGE && (
                                <div className="flex items-center justify-between gap-4 bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
                                    <button
                                        onClick={() => setSubLogShowAll(prev => !prev)}
                                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border bg-white/5 text-gray-400 border-white/10 hover:text-white"
                                    >
                                        {subLogShowAll ? "Paginate (15 per page)" : `Show All (${filteredLogs.length})`}
                                    </button>

                                    {!subLogShowAll && totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={subLogPage === 1}
                                                onClick={() => setSubLogPage(p => Math.max(1, p - 1))}
                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-xs text-gray-400 font-medium">
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                                disabled={subLogPage === totalPages}
                                                onClick={() => setSubLogPage(p => Math.min(totalPages, p + 1))}
                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* One-Time Purchases Tab */}
                {activeTab === "oneTime" && (
                    <div className="space-y-6">
                        {/* Summary cards specifically for One-Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-2xl p-5">
                                <CreditCard className="w-5 h-5 text-pink-400 mb-2" />
                                <div className="text-2xl font-bold text-white">
                                    {data.stats.oneTimePurchasesCount || 0}
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">One-Time Purchases Count</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-5">
                                <Zap className="w-5 h-5 text-amber-400 mb-2" />
                                <div className="text-2xl font-bold text-white">
                                    {formatPrice(data.stats.oneTimeEarnings || 0)}
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">One-Time Earnings</div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-2xl p-5">
                                <TrendingUp className="w-5 h-5 text-blue-400 mb-2" />
                                <div className="text-2xl font-bold text-white">
                                    {data.stats.oneTimePurchasesCount > 0 
                                        ? formatPrice(data.stats.oneTimeEarnings / data.stats.oneTimePurchasesCount)
                                        : "₹0"}
                                </div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1">Average Value per Purchase</div>
                            </div>
                        </div>

                        {/* Interactive Graph Section */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 relative">
                            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                                <div>
                                    <h2 className="text-base font-bold text-white">Sales & Revenue Trends</h2>
                                    <p className="text-xs text-gray-500">Overview of one-time template purchases for the last 30 days</p>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/[0.02] border border-white/5 rounded-xl p-1">
                                    <button onClick={() => setGraphMetric("earnings")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${graphMetric === "earnings" ? "bg-indigo-500 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                                        Earnings
                                    </button>
                                    <button onClick={() => setGraphMetric("count")}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${graphMetric === "count" ? "bg-indigo-500 text-white" : "text-gray-500 hover:text-gray-300"}`}>
                                        Purchases Count
                                    </button>
                                </div>
                            </div>

                            {/* Chart SVG */}
                            <div className="relative w-full overflow-hidden select-none">
                                <svg viewBox="0 0 1000 350" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                                    <defs>
                                        <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
                                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                                        </linearGradient>
                                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="6" result="blur" />
                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                        </filter>
                                    </defs>

                                    {/* Grid Lines & Labels */}
                                    {gridLines.map((line, idx) => (
                                        <g key={idx} className="opacity-40">
                                            <line x1="60" y1={line.y} x2="980" y2={line.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                                            <text x="50" y={line.y + 4} textAnchor="end" className="text-[10px] fill-gray-500 font-semibold">{line.label}</text>
                                        </g>
                                    ))}

                                    {/* Area path */}
                                    {pathData.area && (
                                        <path d={pathData.area} fill="url(#chart-area-grad)" />
                                    )}

                                    {/* Line path */}
                                    {pathData.line && (
                                        <path d={pathData.line} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
                                    )}

                                    {/* X-Axis dates */}
                                    {chartData.map((d, idx) => {
                                        if (idx % 5 === 0 || idx === 29) {
                                            const x = 60 + (idx / 29) * 920;
                                            return (
                                                <text key={idx} x={x} y="335" textAnchor="middle" className="text-[10px] fill-gray-600 font-semibold opacity-80">{d.dateStr}</text>
                                            );
                                        }
                                        return null;
                                    })}

                                    {/* Dotted indicator line on hover */}
                                    {hoveredIndex !== null && points[hoveredIndex] && (
                                        <line x1={points[hoveredIndex].x} y1="20" x2={points[hoveredIndex].x} y2="310" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" strokeDasharray="4 4" />
                                    )}

                                    {/* Glowing dot on hover */}
                                    {hoveredIndex !== null && points[hoveredIndex] && (
                                        <g>
                                            <circle cx={points[hoveredIndex].x} cy={points[hoveredIndex].y} r="10" fill="#6366f1" opacity="0.25" className="animate-ping" />
                                            <circle cx={points[hoveredIndex].x} cy={points[hoveredIndex].y} r="6" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
                                        </g>
                                    )}

                                    {/* Interactive Hover Areas */}
                                    {points.map((p, idx) => {
                                        const rectWidth = 920 / 29;
                                        const rectX = p.x - rectWidth / 2;
                                        return (
                                            <rect key={idx} x={rectX} y="20" width={rectWidth} height="290" fill="transparent" className="cursor-pointer"
                                                onMouseEnter={() => setHoveredIndex(idx)}
                                                onMouseLeave={() => setHoveredIndex(null)}
                                            />
                                        );
                                    })}
                                </svg>

                                {/* HTML Tooltip overlays */}
                                {hoveredIndex !== null && points[hoveredIndex] && (
                                    <div className="absolute bg-[#111115] border border-white/10 rounded-xl p-3 shadow-2xl pointer-events-none transition-all duration-150"
                                        style={{
                                            left: `${(points[hoveredIndex].x / 1000) * 100}%`,
                                            top: `${(points[hoveredIndex].y / 350) * 100 - 15}%`,
                                            transform: "translate(-50%, -100%)",
                                            zIndex: 20
                                        }}
                                    >
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-white/10" />
                                        <div className="absolute bottom-[1px] left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-[#111115]" />
                                        
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                                            {points[hoveredIndex].data.dateStr}
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="flex justify-between items-center gap-6">
                                                <span className="text-xs text-gray-400">Earnings:</span>
                                                <span className="text-xs font-bold text-white">₹{points[hoveredIndex].data.earnings.toLocaleString("en-IN")}</span>
                                            </div>
                                            <div className="flex justify-between items-center gap-6">
                                                <span className="text-xs text-gray-400">Purchases:</span>
                                                <span className="text-xs font-bold text-white">{points[hoveredIndex].data.count}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Purchases Table */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Purchase History</h3>
                                <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-gray-400">
                                    {data.oneTimePurchases ? data.oneTimePurchases.length : 0} Total
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.01]">
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">User</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Template</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Amount</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Credits Issued</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Order ID</th>
                                            <th className="px-5 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Payment ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {(data.oneTimePurchases || []).map(purchase => {
                                            return (
                                                <tr key={purchase.id} className="hover:bg-white/[0.01] transition-colors">
                                                    <td className="px-5 py-4">
                                                        <span className="text-sm font-semibold text-white">{purchase.user_email && purchase.user_email !== "Unknown User" ? purchase.user_email : `user_${purchase.user_id?.slice(0, 8)}`}</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-sm font-semibold text-gray-300">{purchase.template_title}</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-sm font-bold text-white">{formatPrice(purchase.amount)}</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-sm font-semibold text-white">{purchase.credits_remaining} issued</span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                                            purchase.status === "active" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                                                            purchase.status === "exhausted" ? "text-gray-400 bg-gray-500/10 border-gray-500/20" :
                                                            "text-red-400 bg-red-500/10 border-red-500/20"
                                                        }`}>
                                                            {purchase.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span className="text-xs text-gray-400">
                                                            {formatDate(purchase.created_at)}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-xs font-mono text-gray-500">
                                                        {purchase.razorpay_order_id || "-"}
                                                    </td>
                                                    <td className="px-5 py-4 text-xs font-mono text-gray-500">
                                                        {purchase.razorpay_payment_id || "-"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {(!data.oneTimePurchases || data.oneTimePurchases.length === 0) && (
                                <div className="text-center py-16 text-gray-600">
                                    <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No one-time purchases yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}
