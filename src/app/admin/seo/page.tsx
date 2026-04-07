"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Search, Save, Loader2, Globe, Plus, Trash2, Globe2
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface SEOEntry {
    page_path: string;
    title: string;
    description: string;
    keywords: string;
}

export default function AdminSEO() {
    const [seoEntries, setSeoEntries] = useState<SEOEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        fetchSEO();
    }, []);

    const fetchSEO = async () => {
        try {
            const res = await fetch("/api/admin/seo");
            const data = await res.json();
            setSeoEntries(data.seo || []);
        } catch (error) {
            console.error("Error:", error);
            toast.error("Failed to load SEO settings");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (entry: SEOEntry) => {
        setSaving(entry.page_path);
        try {
            const res = await fetch("/api/admin/seo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(entry),
            });
            if (res.ok) {
                toast.success(`SEO for ${entry.page_path} saved`);
            } else {
                throw new Error("Save failed");
            }
        } catch (error) {
            toast.error("Failed to save changes");
        } finally {
            setSaving(null);
        }
    };

    const updateEntry = (path: string, field: keyof SEOEntry, value: string) => {
        setSeoEntries(prev => prev.map(e => e.page_path === path ? { ...e, [field]: value } : e));
    };

    const addEntry = () => {
        const path = prompt("Enter page path (e.g. /about)");
        if (!path) return;
        if (seoEntries.find(e => e.page_path === path)) {
            toast.error("Entry already exists");
            return;
        }
        setSeoEntries([...seoEntries, { page_path: path, title: "", description: "", keywords: "" }]);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Globe className="w-6 h-6 text-indigo-500" />
                            <h1 className="text-xl font-bold text-white">Global SEO</h1>
                        </div>
                    </div>

                    <button
                        onClick={addEntry}
                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all"
                    >
                        <Plus className="w-4 h-4" /> Add Page
                    </button>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 gap-6">
                    {seoEntries.map((entry) => (
                        <motion.div
                            key={entry.page_path}
                            layout
                            className="bg-white/[0.02] border border-white/5 rounded-3xl p-8"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                        <Globe2 className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">{entry.page_path}</h2>
                                        <p className="text-xs text-gray-500">Global site metadata</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleSave(entry)}
                                    disabled={saving === entry.page_path}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                                >
                                    {saving === entry.page_path ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Save
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Meta Title</label>
                                        <input
                                            type="text"
                                            value={entry.title}
                                            onChange={(e) => updateEntry(entry.page_path, "title", e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Keywords</label>
                                        <input
                                            type="text"
                                            value={entry.keywords}
                                            onChange={(e) => updateEntry(entry.page_path, "keywords", e.target.value)}
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Meta Description</label>
                                    <textarea
                                        value={entry.description}
                                        onChange={(e) => updateEntry(entry.page_path, "description", e.target.value)}
                                        rows={5}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ))}

                    {seoEntries.length === 0 && (
                        <div className="text-center py-24 bg-white/[0.01] border border-dashed border-white/5 rounded-[40px]">
                            <Globe className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">No SEO Overrides</h3>
                            <p className="text-gray-500 mb-8 max-w-xs mx-auto">Add your first page-specific SEO override to improve indexing.</p>
                            <button
                                onClick={addEntry}
                                className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-bold text-white transition-all"
                            >
                                Add Your First Page
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
