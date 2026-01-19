"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
    Video, Clock, CheckCircle2, AlertCircle,
    Download, ExternalLink, RefreshCw, LogOut,
    Play, Layout, User, Trash2, Settings
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error("Please log in to view your dashboard");
            router.push("/login");
            return;
        }
        setUser(user);

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
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (jobsError) throw jobsError;
            setJobs(jobsData || []);

            // Fetch Projects
            const projRes = await fetch(`/api/projects?userId=${user.id}`);
            const projData = await projRes.json();
            if (projRes.ok) {
                setProjects(projData.projects || []);
            }

            // Check if admin
            const { data: adminData } = await supabase
                .from("admins")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (adminData) {
                setIsAdmin(true);
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
            const res = await fetch(`/api/projects/${id}?userId=${user.id}`, {
                method: "DELETE"
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
                        <img
                            src={`${process.env.NEXT_PUBLIC_S3_URL}/logos/02.png`}
                            alt="CelitePro Logo"
                            className="w-10 h-10 object-contain"
                        />
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            CelitePro
                        </span>
                    </Link>

                    <div className="flex items-center gap-6">
                        {isAdmin && (
                            <Link href="/admin" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-all flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                                <Settings className="w-4 h-4" />
                                Admin Panel
                            </Link>
                        )}
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
                <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">My Account</h1>
                        <p className="text-sm md:text-base text-gray-500">Manage your renders and account settings.</p>
                    </div>

                    {user && (
                        <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl w-full md:w-auto">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600/20 rounded-full flex items-center justify-center shrink-0">
                                <User className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
                            </div>
                            <div className="min-w-0 text-left">
                                <div className="text-xs md:text-sm font-bold text-white uppercase tracking-wider truncate">
                                    {user.user_metadata?.full_name || "User Account"}
                                </div>
                                <div className="text-[10px] md:text-xs text-gray-500 truncate">{user.email}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-8 border-b border-white/5 mb-12">
                    <button
                        onClick={() => setActiveTab("projects")}
                        className={`pb-4 text-sm font-bold transition-all relative ${activeTab === "projects" ? "text-white" : "text-gray-500 hover:text-gray-300"
                            }`}
                    >
                        My Projects
                        {activeTab === "projects" && (
                            <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("renders")}
                        className={`pb-4 text-sm font-bold transition-all relative ${activeTab === "renders" ? "text-white" : "text-gray-500 hover:text-gray-300"
                            }`}
                    >
                        Render History
                        {activeTab === "renders" && (
                            <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                        )}
                    </button>
                </div>

                {/* Grid Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                        <h2 className="text-xl font-bold text-white">
                            {activeTab === "projects" ? "Saved Projects" : "Recent Renders"}
                        </h2>
                        <span className="ml-2 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-gray-500 font-mono">
                            {activeTab === "projects" ? projects.length : jobs.length} total
                        </span>
                    </div>
                    {activeTab === "projects" && (
                        <Link
                            href="/templates"
                            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
                        >
                            + New Project
                        </Link>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="aspect-video bg-white/[0.01] border border-white/5 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : activeTab === "projects" ? (
                    projects.length === 0 ? (
                        <div className="text-center py-24 bg-white/[0.02] border border-white/5 border-dashed rounded-3xl">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-600">
                                <Layout className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">No projects saved</h3>
                            <p className="text-gray-500 max-w-sm mx-auto mb-8">
                                Save your work in the editor to see it here.
                            </p>
                            <Link
                                href="/templates"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
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
                                        className="group relative bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.04] hover:border-white/10 transition-all shadow-xl"
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
                                                        src={`${process.env.NEXT_PUBLIC_S3_URL}/logos/02.png`}
                                                        alt="Logo"
                                                        className="w-12 h-12 opacity-20"
                                                    />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />

                                            <div className="absolute top-4 right-4">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-black/40 backdrop-blur-md px-2 py-1 rounded border border-white/10">
                                                    {project.template?.title}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-5">
                                            <h3 className="text-lg font-bold text-white mb-1 truncate">
                                                {project.name}
                                            </h3>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
                                                <Clock className="w-3 h-3" />
                                                Updated {new Date(project.updated_at).toLocaleDateString()}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/templates/${project.template.slug}/editor/${project.id}`}
                                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                                                >
                                                    <Layout className="w-3 h-3" />
                                                    Edit Project
                                                </Link>
                                                <Link
                                                    href={`/templates/${project.template.slug}`}
                                                    className="p-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg transition-all"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDeleteProject(project.id)}
                                                    className="p-2.5 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 rounded-lg transition-all"
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
                        <div className="text-center py-24 bg-white/[0.02] border border-white/5 border-dashed rounded-3xl">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <img
                                    src={`${process.env.NEXT_PUBLIC_S3_URL}/logos/02.png`}
                                    alt="Logo"
                                    className="w-10 h-10 opacity-30"
                                />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">No renders yet</h3>
                            <p className="text-gray-500 max-w-sm mx-auto mb-8">
                                Render a video to see your history here.
                            </p>
                            <Link
                                href="/templates"
                                className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
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
                                                    <img
                                                        src={`${process.env.NEXT_PUBLIC_S3_URL}/logos/02.png`}
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
                    )
                )}
            </div>
        </main>
    );
}

