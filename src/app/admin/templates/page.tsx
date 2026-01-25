"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, Layers, Search, Edit3, Trash2,
    ArrowLeft, Loader2, Video, ImageIcon, Type, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Template {
    id: string;
    slug: string;
    title: string;
    category: string;
    thumbnail_url: string;
    image_placeholders: any[];
    text_placeholders: any[];
}

export default function AdminTemplates() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const router = useRouter();

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch("/api/admin/templates?showAll=true");
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

        try {
            const res = await fetch(`/api/admin/templates/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Template deleted");
                setTemplates(templates.filter(t => t.id !== id));
            } else {
                throw new Error("Failed to delete");
            }
        } catch (error) {
            console.error("Error:", error);
            toast.error("Delete failed");
        }
    };

    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </Link>
                        <h1 className="text-xl font-bold text-white">Manage Templates</h1>
                    </div>

                    <Link
                        href="/admin/templates/new"
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all"
                    >
                        <Plus className="w-4 h-4" /> Add New Template
                    </Link>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Search and Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search templates by title or slug..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:outline-none transition-all"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <p className="text-sm text-gray-500 font-medium">Fetching your templates...</p>
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-20 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl">
                        <Layers className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">No Templates Found</h3>
                        <p className="text-sm text-gray-500 max-w-xs mx-auto">
                            {searchQuery ? "Try adjusting your search query." : "Start by adding your first video template."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredTemplates.map((template) => (
                                <motion.div
                                    key={template.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="group bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden hover:bg-white/[0.03] transition-all"
                                >
                                    <div className="aspect-video relative overflow-hidden bg-black/40">
                                        {template.thumbnail_url ? (
                                            <img
                                                src={template.thumbnail_url}
                                                alt={template.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Video className="w-10 h-10 text-gray-800" />
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                                            {template.category}
                                        </div>
                                    </div>

                                    <div className="p-6">
                                        <h3 className="text-base font-bold text-white mb-1 truncate">{template.title}</h3>
                                        <p className="text-xs text-gray-600 font-mono mb-4">{template.slug}</p>

                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/5">
                                                <ImageIcon className="w-3 h-3 text-purple-400" />
                                                <span className="text-[10px] font-bold text-gray-400">{template.image_placeholders?.length || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-md border border-white/5">
                                                <Type className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[10px] font-bold text-gray-400">{template.text_placeholders?.length || 0}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/templates/${template.id}/edit`}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-white transition-all"
                                            >
                                                <Edit3 className="w-3 h-3" /> Edit
                                            </Link>
                                            <button
                                                onClick={() => handleDelete(template.id, template.title)}
                                                className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
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
