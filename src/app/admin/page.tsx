"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Plus, Layers, Search, Edit3, Trash2,
    Video, Image as ImageIcon, FileText, ExternalLink
} from "lucide-react";

interface Template {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    thumbnail_url: string;
    image_placeholders: { key: string; label: string }[];
    text_placeholders: { key: string; label: string }[];
    created_at: string;
}

export default function AdminDashboard() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch("/api/admin/templates");
            const data = await res.json();
            setTemplates(data.templates || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this template?")) return;

        try {
            await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
            setTemplates((prev) => prev.filter((t) => t.id !== id));
        } catch (error) {
            console.error("Error deleting template:", error);
        }
    };

    const filteredTemplates = templates.filter((t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-2 rounded-xl">
                            <Video className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                            <p className="text-xs text-gray-500">CelitePro Template Management</p>
                        </div>
                    </div>

                    <Link
                        href="/admin/templates/new"
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        New Template
                    </Link>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                                <Layers className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{templates.length}</div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Total Templates</div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {templates.reduce((acc, t) => acc + (t.image_placeholders?.length || 0), 0)}
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Image Layers</div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                                <FileText className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {templates.reduce((acc, t) => acc + (t.text_placeholders?.length || 0), 0)}
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Text Layers</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-8">
                    <div className="relative max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search templates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                        />
                    </div>
                </div>

                {/* Templates Grid */}
                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading templates...</div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Layers className="w-6 h-6 text-gray-600" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">No templates yet</h3>
                        <p className="text-gray-500 mb-6">Create your first template to get started.</p>
                        <Link
                            href="/admin/templates/new"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
                        >
                            <Plus className="w-4 h-4" /> Create Template
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTemplates.map((template) => (
                            <motion.div
                                key={template.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:bg-white/[0.04] transition-all"
                            >
                                <div className="aspect-video bg-gradient-to-br from-indigo-500/10 to-purple-500/5 relative">
                                    {template.thumbnail_url ? (
                                        <img
                                            src={template.thumbnail_url}
                                            alt={template.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Video className="w-10 h-10 text-white/10" />
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 flex gap-2">
                                        <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-[10px] font-bold text-white rounded border border-white/10">
                                            {template.image_placeholders?.length || 0} Images
                                        </span>
                                        <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-[10px] font-bold text-white rounded border border-white/10">
                                            {template.text_placeholders?.length || 0} Text
                                        </span>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">
                                        {template.category}
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2 truncate">{template.title}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">{template.description || "No description"}</p>

                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/templates/${template.id}/edit`}
                                            className="flex-1 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-indigo-600 hover:border-indigo-600 transition-all"
                                        >
                                            <Edit3 className="w-3 h-3" /> Edit
                                        </Link>
                                        <Link
                                            href={`/templates/${template.slug}`}
                                            className="py-2 px-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(template.id)}
                                            className="py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
