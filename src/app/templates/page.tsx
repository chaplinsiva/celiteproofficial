"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, SlidersHorizontal, Play, Edit3,
    Zap, Loader2, Layers, Image as ImageIcon, Type
} from "lucide-react";
import Link from "next/link";

const CATEGORIES = ["All", "Logo Stings", "Promos", "Social Media", "Corporate", "Titles", "General"];

interface Template {
    id: string;
    slug: string;
    title: string;
    category: string;
    duration: string;
    aspect_ratio: string;
    thumbnail_url: string;
    image_placeholders: { key: string }[];
    text_placeholders: { key: string }[];
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("All");
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

    const filteredTemplates = templates.filter(t => {
        const matchesCategory = selectedCategory === "All" || t.category === selectedCategory;
        const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <main className="min-h-screen bg-[#0A0A0B]">
            <Header />

            <div className="pt-32 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Template Marketplace</h1>
                        <p className="text-gray-400 text-lg">Browse professional templates for your next project.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group flex-1 md:w-80">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap gap-2 mb-12">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${selectedCategory === cat
                                ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Templates Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        <AnimatePresence mode="popLayout">
                            {filteredTemplates.map((template) => (
                                <motion.div
                                    layout
                                    key={template.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="group relative bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden transition-all hover:bg-white/[0.04] flex flex-col"
                                >
                                    <div className="aspect-video bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent relative overflow-hidden group">
                                        {template.thumbnail_url ? (
                                            <img
                                                src={template.thumbnail_url}
                                                alt={template.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Play className="w-12 h-12 text-white/10 group-hover:text-indigo-500 group-hover:scale-110 transition-all opacity-20 group-hover:opacity-100" />
                                            </div>
                                        )}
                                        {/* Tags */}
                                        <div className="absolute top-4 left-4 flex gap-2">
                                            <span className="px-2 py-1 rounded-md bg-black/40 backdrop-blur-md text-[10px] font-bold text-white border border-white/10 uppercase">
                                                {template.aspect_ratio || "16:9"}
                                            </span>
                                        </div>
                                        <div className="absolute top-4 right-4 flex gap-1">
                                            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[9px] font-bold text-white rounded border border-white/10 flex items-center gap-1">
                                                <ImageIcon className="w-2.5 h-2.5" /> {template.image_placeholders?.length || 0}
                                            </span>
                                            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[9px] font-bold text-white rounded border border-white/10 flex items-center gap-1">
                                                <Type className="w-2.5 h-2.5" /> {template.text_placeholders?.length || 0}
                                            </span>
                                        </div>
                                        {template.duration && (
                                            <div className="absolute bottom-4 right-4 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                                                {template.duration}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-6 flex-1 flex flex-col">
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">
                                            {template.category}
                                        </span>
                                        <h3 className="text-lg font-bold text-white mb-6 group-hover:text-indigo-400 transition-colors">
                                            {template.title}
                                        </h3>
                                        <div className="mt-auto">
                                            <Link
                                                href={`/templates/${template.slug}`}
                                                className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:bg-indigo-600 hover:border-indigo-600 group/btn"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                                Customize
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredTemplates.length === 0 && (
                    <div className="py-24 text-center">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Layers className="w-8 h-8 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No templates found</h3>
                        <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                    </div>
                )}
            </div>

            {/* Floating CTA for new users */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                <motion.div
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-6 backdrop-blur-xl border border-white/20"
                >
                    <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 fill-current" />
                        <span className="text-sm font-medium whitespace-nowrap">Upload your own After Effects template</span>
                    </div>
                    <div className="h-6 w-px bg-white/20" />
                    <Link href="/admin/templates/new" className="text-sm font-bold hover:underline">Get Started</Link>
                </motion.div>
            </div>
        </main>
    );
}
