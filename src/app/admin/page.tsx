"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
    Layout, Video, Users, BarChart3,
    ArrowLeft, Clock, CheckCircle2, AlertCircle,
    RefreshCw, Search, ShieldCheck, ExternalLink, Settings, Globe
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AdminStats {
    totalUsers: number;
    totalProjects: number;
    totalRenders: number;
    completedRenders: number;
}

interface RenderJob {
    id: string;
    status: string;
    created_at: string;
    user_email?: string;
    template_title?: string;
}

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [stats, setStats] = useState<AdminStats>({
        totalUsers: 0,
        totalProjects: 0,
        totalRenders: 0,
        completedRenders: 0
    });
    const [recentRenders, setRecentRenders] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        checkAdmin();
    }, []);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }

        const { data: adminData, error } = await supabase
            .from("admins")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (error || !adminData) {
            toast.error("Access denied. Admin only.");
            router.push("/dashboard");
            return;
        }

        setIsAdmin(true);
        fetchAdminData();
    };

    const fetchAdminData = async () => {
        try {
            // Fetch Stats (Global) - Requires matching RLS or bypass (using client with anon key might be restricted)
            // For now, we fetch what we can. Usually admin pages use a more privileged client or specific API.

            const { count: usersCount } = await supabase
                .from("profiles") // Assuming there's a profiles table for public user info
                .select("*", { count: 'exact', head: true });

            const { count: projectsCount } = await supabase
                .from("projects")
                .select("*", { count: 'exact', head: true });

            const { data: rendersData, count: rendersCount } = await supabase
                .from("render_jobs")
                .select(`
                    *,
                    template:templates (title)
                `)
                .order("created_at", { ascending: false })
                .limit(10);

            const { count: completedCount } = await supabase
                .from("render_jobs")
                .select("*", { count: 'exact', head: true })
                .eq("status", "completed");

            setStats({
                totalUsers: usersCount || 0,
                totalProjects: projectsCount || 0,
                totalRenders: rendersCount || 0,
                completedRenders: completedCount || 0
            });

            setRecentRenders(rendersData || []);
        } catch (err) {
            console.error("Error fetching admin data:", err);
            toast.error("Failed to load admin statistics");
        } finally {
            setLoading(false);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-indigo-500" />
                            <h1 className="text-xl font-bold text-white">Admin Control</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Master Access</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: "Total Renders", value: stats.totalRenders, icon: Video, color: "text-blue-400" },
                        { label: "Completed", value: stats.completedRenders, icon: CheckCircle2, color: "text-emerald-400" },
                        { label: "Total Projects", value: stats.totalProjects, icon: Layout, color: "text-purple-400" },
                        { label: "Platform Users", value: stats.totalUsers, icon: Users, color: "text-orange-400" },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-2 rounded-lg bg-white/5 ${stat.color}`}>
                                    <stat.icon className="w-5 h-5" />
                                </div>
                                <BarChart3 className="w-4 h-4 text-gray-700" />
                            </div>
                            <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Recent Activities */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                Global Render Queue
                            </h2>
                            <button className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition-colors">View All</button>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-white/[0.01]">
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Render ID / Template</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Created At</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {recentRenders.map((render) => (
                                            <tr key={render.id} className="hover:bg-white/[0.01] transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-white truncate max-w-[200px]">
                                                            {render.template?.title || "Unknown Template"}
                                                        </span>
                                                        <span className="text-[10px] text-gray-600 font-mono underline decoration-white/5 decoration-dotted">
                                                            {render.id.slice(0, 18)}...
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(render.status)}
                                                        <span className="text-xs font-semibold capitalize">{render.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(render.created_at).toLocaleString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Link
                                                        href={`/render/${render.id}`}
                                                        className="p-2 hover:bg-white/5 rounded-lg inline-flex items-center gap-2 text-gray-500 hover:text-white transition-all"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Quick Tools */}
                    <div className="space-y-6">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Settings className="w-5 h-5 text-indigo-400" />
                            Admin Actions
                        </h2>

                        <div className="space-y-3">
                            {[
                                { label: "Manage Templates", icon: Layout, desc: "Edit or add new video templates", href: "/admin/templates" },
                                { label: "Global SEO", icon: Globe, desc: "Manage site-wide meta tags & indexing", href: "/admin/seo" },
                                { label: "User Management", icon: Users, desc: "View and manage platform users", href: "/admin/users" },
                                { label: "Global Settings", icon: Settings, desc: "API keys and platform config", href: "/admin/settings" },
                            ].map((tool, i) => (
                                <Link key={i} href={tool.href} className="w-full p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4 hover:bg-white/[0.04] hover:border-white/10 transition-all text-left">
                                    <div className="p-2.5 rounded-xl bg-white/5 text-gray-400">
                                        <tool.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">{tool.label}</div>
                                        <div className="text-[10px] text-gray-500">{tool.desc}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>

                        <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl relative overflow-hidden group">
                            <div className="relative z-10">
                                <h3 className="text-sm font-bold text-white mb-2">System Health</h3>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    <span className="text-xs text-emerald-500 font-bold uppercase tracking-wider">All Systems Operational</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-gray-500">Plainly API</span>
                                        <span className="text-emerald-400">Active</span>
                                    </div>
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-gray-500">Supabase DB</span>
                                        <span className="text-emerald-400">Active</span>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <ShieldCheck className="w-16 h-16 text-indigo-400" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
