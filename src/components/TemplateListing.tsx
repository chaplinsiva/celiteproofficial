"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Play, Edit3, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface Template {
    id: string;
    slug: string;
    title: string;
    category: string;
    duration: string;
    thumbnail_url: string;
    image_placeholders: { key: string }[];
    text_placeholders: { key: string }[];
}

const TemplateListing = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch("/api/admin/templates");
            const data = await res.json();
            setTemplates(data.templates?.slice(0, 4) || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="templates" className="py-24 bg-[#0A0A0B] border-t border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-4">
                            <Layers className="w-4 h-4" />
                            <span>Library</span>
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-4">Professional Templates</h2>
                        <p className="text-gray-400 text-lg">
                            Choose from our curated collection of high-end After Effects templates,
                            designed for maximum impact and easy customization.
                        </p>
                    </div>
                    <Link href="/templates" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                        View All Templates <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-20">
                        <Layers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500">No templates available yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {templates.map((template) => (
                            <motion.div
                                key={template.id}
                                whileHover={{ y: -8 }}
                                className="group relative bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden transition-all hover:bg-white/[0.04] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
                            >
                                <div className="aspect-[16/9] bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent relative overflow-hidden">
                                    {template.thumbnail_url ? (
                                        <img
                                            src={template.thumbnail_url}
                                            alt={template.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Play className="w-8 h-8 text-white/20" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                            <Play className="w-6 h-6 text-white fill-current" />
                                        </div>
                                    </div>
                                    {template.duration && (
                                        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                                            {template.duration}
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3 flex gap-1">
                                        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[9px] font-bold text-white rounded border border-white/10">
                                            {template.image_placeholders?.length || 0} IMG
                                        </span>
                                        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[9px] font-bold text-white rounded border border-white/10">
                                            {template.text_placeholders?.length || 0} TXT
                                        </span>
                                    </div>
                                </div>

                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                            {template.category}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-6 group-hover:text-indigo-400 transition-colors">
                                        {template.title}
                                    </h3>

                                    <Link
                                        href={`/templates/${template.slug}`}
                                        className="w-full py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:bg-indigo-600 hover:border-indigo-600 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                        Edit Template
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default TemplateListing;
