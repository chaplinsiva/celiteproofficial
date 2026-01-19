"use client";

import React from "react";
import Header from "@/components/Header";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, Clock, Layers, Share2, Edit3, ArrowLeft, Image as ImageIcon, Type, User, Check } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface ImagePlaceholder {
    key: string;
    label: string;
    aspectRatio: string;
}

interface TextPlaceholder {
    key: string;
    label: string;
    defaultValue: string;
}

interface Template {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    duration: string;
    aspect_ratio: string;
    preview_url: string;
    thumbnail_url: string;
    image_placeholders: ImagePlaceholder[];
    text_placeholders: TextPlaceholder[];
}

export default function TemplateClient({ template }: { template: Template }) {
    const router = useRouter();
    const [showAlert, setShowAlert] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    const handleShare = async () => {
        const shareData = {
            title: `${template.title} | CelitePro`,
            text: template.description || `Check out this professional video template: ${template.title}`,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error("Error copying to clipboard:", err);
            }
        }
    };

    return (
        <main className="min-h-screen bg-[#0A0A0B] relative">
            <Header />

            <AnimatePresence>
                {showAlert && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-[#111113] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl"
                        >
                            <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <User className="w-8 h-8 text-indigo-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Almost There!</h3>
                            <p className="text-gray-400 mb-8">Create an account or login to customize and render this template.</p>
                            <div className="flex flex-col gap-3">
                                <Link
                                    href="/signup"
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl"
                                >
                                    Join Now & Edit
                                </Link>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500 mb-2">Already have an account?</p>
                                    <Link
                                        href="/login"
                                        className="text-indigo-400 hover:text-indigo-300 font-bold text-sm"
                                    >
                                        Log In Here
                                    </Link>
                                </div>
                                <button
                                    onClick={() => setShowAlert(false)}
                                    className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24">
                <Link href="/templates" className="inline-flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Templates
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Left: Video Preview */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <div className="aspect-video bg-white/5 rounded-3xl border border-white/10 overflow-hidden relative group">
                            {template.preview_url ? (
                                <video
                                    src={template.preview_url}
                                    className="w-full h-full object-cover"
                                    controls
                                    poster={template.thumbnail_url}
                                />
                            ) : template.thumbnail_url ? (
                                <img src={template.thumbnail_url} alt={template.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="p-10 border-2 border-dashed border-white/20 rounded-full">
                                        <Play className="w-12 h-12 text-indigo-400 fill-current" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Placeholder Info Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <ImageIcon className="w-4 h-4 text-purple-400" />
                                    <span className="text-xs font-bold text-white uppercase">Image Layers</span>
                                </div>
                                <div className="space-y-2">
                                    {template.image_placeholders?.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="text-gray-400">{p.label}</span>
                                            <span className="text-gray-600 font-mono">{p.aspectRatio}</span>
                                        </div>
                                    ))}
                                    {!template.image_placeholders?.length && (
                                        <span className="text-gray-600 text-xs">No image layers</span>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <Type className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-bold text-white uppercase">Text Layers</span>
                                </div>
                                <div className="space-y-2">
                                    {template.text_placeholders?.map((p, i) => (
                                        <div key={i} className="text-xs text-gray-400">{p.label}</div>
                                    ))}
                                    {!template.text_placeholders?.length && (
                                        <span className="text-gray-600 text-xs">No text layers</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right: Details */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
                            <Sparkles className="w-4 h-4" />
                            <span>{template.category}</span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
                            {template.title}
                        </h1>

                        <p className="text-gray-500 md:text-gray-400 text-base md:text-lg mb-10 leading-relaxed">
                            {template.description || "Elevate your brand with this high-quality motion graphic template. Fully customizable layers and brand-matching."}
                        </p>

                        <div className="grid grid-cols-2 gap-8 mb-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">Duration</div>
                                    <div className="text-white font-medium">{template.duration || "N/A"}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                    <Layers className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">Layers</div>
                                    <div className="text-white font-medium">
                                        {(template.image_placeholders?.length || 0) + (template.text_placeholders?.length || 0)} Custom Assets
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-white/5">
                            <button
                                onClick={async () => {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) {
                                        setShowAlert(true);
                                        return;
                                    }
                                    router.push(`/templates/${template.slug}/editor/${template.id}`);
                                }}
                                className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all group"
                            >
                                <Edit3 className="w-5 h-5" />
                                Edit in Editor
                            </button>
                            <button
                                onClick={handleShare}
                                className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
                                {copied ? "Copied!" : "Share"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </main>
    );
}
