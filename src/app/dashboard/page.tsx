"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
    Video, Clock, CheckCircle2, AlertCircle,
    Download, ExternalLink, RefreshCw, LogOut,
    Play, Layout, User
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }
        setUser(user);

        try {
            const { data, error } = await supabase
                .from("render_jobs")
                .select(`
                    *,
                    template:templates (
                        title,
                        thumbnail_url,
                        slug
                    )
                `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setJobs(data || []);
        } catch (err) {
            console.error("Error fetching jobs:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
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

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            {/* Navigation / Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="bg-indigo-600 p-2 rounded-xl">
                            <Video className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            CelitePro
                        </span>
                    </Link>

                    <div className="flex items-center gap-6">
                        <Link href="/templates" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                            Browse Templates
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-red-400 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* User Profile Summary */}
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">My Account</h1>
                        <p className="text-gray-500">Manage your renders and account settings.</p>
                    </div>

                    {user && (
                        <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-full flex items-center justify-center">
                                <User className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white uppercase tracking-wider">
                                    {user.user_metadata?.full_name || "User Account"}
                                </div>
                                <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Grid Header */}
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    <h2 className="text-xl font-bold text-white">Render History</h2>
                    <span className="ml-2 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-gray-500 font-mono">
                        {jobs.length} total
                    </span>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="aspect-video bg-white/[0.01] border border-white/5 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="text-center py-24 bg-white/[0.02] border border-white/5 border-dashed rounded-3xl">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-600">
                            <Layout className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">No videos yet</h3>
                        <p className="text-gray-500 max-w-sm mx-auto mb-8">
                            You haven&apos;t rendered any videos yet. Head over to our templates collection to get started.
                        </p>
                        <Link
                            href="/templates"
                            className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            Start Creating
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
                                    className="group relative bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/10 transition-all shadow-xl"
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
                                                <Video className="w-10 h-10 text-white/10" />
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
                                        <h3 className="text-lg font-bold text-white mb-1 truncate">
                                            {job.template?.title || "Untitled Project"}
                                        </h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
                                            <Clock className="w-3 h-3" />
                                            {new Date(job.created_at).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            {job.status === "completed" ? (
                                                <>
                                                    <a
                                                        href={job.output_url!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                                                    >
                                                        <Download className="w-3 h-3" />
                                                        View & Download
                                                    </a>
                                                    <Link
                                                        href={`/render/${job.id}`}
                                                        className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-all"
                                                        title="Track Progress"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Link>
                                                </>
                                            ) : job.status === "failed" ? (
                                                <div className="w-full flex flex-col gap-2">
                                                    <div className="text-[10px] text-red-400 font-medium px-2 py-1 bg-red-400/5 rounded border border-red-400/10 line-clamp-1">
                                                        {job.error_message || "Unknown error"}
                                                    </div>
                                                    <Link
                                                        href={`/templates/${job.template?.slug || ""}`}
                                                        className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2"
                                                    >
                                                        <RefreshCw className="w-3 h-3" />
                                                        Retry Render
                                                    </Link>
                                                </div>
                                            ) : (
                                                <Link
                                                    href={`/render/${job.id}`}
                                                    className="w-full py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 animate-shimmer"
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
                )}
            </div>
        </main>
    );
}

