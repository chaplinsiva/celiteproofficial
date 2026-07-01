"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Play, Volume2, VolumeX, ShieldCheck, Heart, Zap, Loader2 } from "lucide-react";

interface Template {
    id: string;
    slug: string;
    title: string;
    category: string;
    preview_url: string;
    thumbnail_url: string;
}

const Hero = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [muted, setMuted] = useState(true);
    const mainVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        fetch("/api/admin/templates")
            .then(r => r.json())
            .then(d => {
                const fetched = (d.templates || []).filter((t: Template) => t.preview_url);
                
                // Premium Mixkit wedding preview loops as robust defaults/fallbacks
                const fallbacks: Template[] = [
                    {
                        id: "fb-1",
                        slug: "floral-classic",
                        title: "Elegant Floral Watercolor",
                        category: "Classic",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-beautiful-bride-posing-in-front-of-a-mirror-42171-large.mp4",
                        thumbnail_url: ""
                    },
                    {
                        id: "fb-2",
                        slug: "royal-gold",
                        title: "Royal Golden Monogram",
                        category: "Royal",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-newlywed-couple-with-their-rings-42183-large.mp4",
                        thumbnail_url: ""
                    },
                    {
                        id: "fb-3",
                        slug: "minimal-modern",
                        title: "Minimalist Typography Invitation",
                        category: "Minimalist",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-wedding-rings-lying-on-a-surface-42180-large.mp4",
                        thumbnail_url: ""
                    }
                ];

                if (fetched.length < 3) {
                    // Combine database items and fallbacks to ensure exactly 3 video loops are visible
                    const combined = [...fetched, ...fallbacks.slice(0, 3 - fetched.length)];
                    setTemplates(combined);
                } else {
                    setTemplates(fetched.slice(0, 3));
                }
            })
            .catch(() => {
                setTemplates([
                    {
                        id: "fb-1",
                        slug: "floral-classic",
                        title: "Elegant Floral Watercolor",
                        category: "Classic",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-beautiful-bride-posing-in-front-of-a-mirror-42171-large.mp4",
                        thumbnail_url: ""
                    },
                    {
                        id: "fb-2",
                        slug: "royal-gold",
                        title: "Royal Golden Monogram",
                        category: "Royal",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-newlywed-couple-with-their-rings-42183-large.mp4",
                        thumbnail_url: ""
                    },
                    {
                        id: "fb-3",
                        slug: "minimal-modern",
                        title: "Minimalist Typography Invitation",
                        category: "Minimalist",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-wedding-rings-lying-on-a-surface-42180-large.mp4",
                        thumbnail_url: ""
                    }
                ]);
            });
    }, []);

    return (
        <section className="relative min-h-[92vh] flex items-center bg-white overflow-hidden py-16 lg:py-24">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-rose-500/5 blur-[100px] rounded-full pointer-events-none" />
            
            {/* Subtle Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.015)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                    
                    {/* LEFT COLUMN: Hero Copy & Actions */}
                    <div className="lg:col-span-6 flex flex-col items-start text-left max-w-2xl order-2 lg:order-1">
                        
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-bold tracking-wide mb-6 shadow-sm shadow-slate-100/50"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                            Next-Gen Wedding Video Maker
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-black text-slate-900 leading-[1.08] tracking-tight mb-6"
                        >
                            Craft the Perfect <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500">
                                Wedding Motion
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="text-base sm:text-lg text-slate-500 mb-8 max-w-xl leading-relaxed"
                        >
                            Create premium, studio-quality wedding video invitations in minutes. Customize elegant invitation templates directly in our next-gen editor.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-10"
                        >
                            <Link
                                href="/pricing"
                                className="px-8 py-4 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-900/10"
                            >
                                Get Started
                                <ArrowRight className="w-4 h-4" />
                            </Link>

                            <Link
                                href="/templates"
                                className="px-8 py-4 bg-white text-slate-800 text-sm font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
                                    <Play className="w-2.5 h-2.5 fill-current text-blue-600 ml-0.5" />
                                </div>
                                Browse Templates
                            </Link>
                        </motion.div>

                        {/* Feature Badges Grid */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="grid grid-cols-3 gap-6 border-t border-slate-100 pt-8 w-full"
                        >
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                                    <Zap className="w-4 h-4 text-indigo-500" />
                                    <span>Instant</span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-bold">5-Minute Setup</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                                    <Heart className="w-4 h-4 text-rose-500" />
                                    <span>Premium</span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-bold">Designer Layouts</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                                    <span>Full HD</span>
                                </div>
                                <p className="text-[11px] text-slate-400 font-bold">UHD Video Export</p>
                            </div>
                        </motion.div>

                    </div>

                    {/* RIGHT COLUMN: Staggered Floating Video Wall */}
                    <div className="lg:col-span-6 relative h-[440px] sm:h-[500px] lg:h-[540px] flex items-center justify-center mt-6 lg:mt-0 order-1 lg:order-2">
                        {/* Glow Behind Video Wall */}
                        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/10 blur-[70px] rounded-full -z-10 animate-pulse pointer-events-none" />
                        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-rose-500/10 blur-[70px] rounded-full -z-10 animate-pulse pointer-events-none" />

                        {templates.length >= 3 ? (
                            <div className="relative w-full h-full max-w-[440px]">
                                
                                {/* Card 1: Left Background Card */}
                                <motion.div 
                                    className="absolute left-0 top-[18%] w-[48%] aspect-[9/16] rounded-2xl overflow-hidden border border-slate-200/80 shadow-lg bg-slate-50 select-none z-10 origin-bottom-left cursor-pointer"
                                    style={{ rotate: -7 }}
                                    whileHover={{ scale: 1.04, rotate: -2, zIndex: 30 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                >
                                    <Link href={`/templates/${templates[0].slug}`} className="absolute inset-0 block">
                                        <video
                                            src={templates[0].preview_url}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            className="w-full h-full object-cover pointer-events-none"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                                        <div className="absolute bottom-3 left-3 right-3 text-white text-[10px] font-bold truncate">
                                            {templates[0].title}
                                        </div>
                                    </Link>
                                </motion.div>

                                {/* Card 2: Right Background Card */}
                                <motion.div 
                                    className="absolute right-0 top-[26%] w-[44%] aspect-[9/16] rounded-2xl overflow-hidden border border-slate-200/80 shadow-lg bg-slate-50 select-none z-10 origin-bottom-right cursor-pointer"
                                    style={{ rotate: 8 }}
                                    whileHover={{ scale: 1.04, rotate: 3, zIndex: 30 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                >
                                    <Link href={`/templates/${templates[2].slug}`} className="absolute inset-0 block">
                                        <video
                                            src={templates[2].preview_url}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            className="w-full h-full object-cover pointer-events-none"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                                        <div className="absolute bottom-3 left-3 right-3 text-white text-[10px] font-bold truncate">
                                            {templates[2].title}
                                        </div>
                                    </Link>
                                </motion.div>

                                {/* Card 3: Main Foreground Center Card */}
                                <motion.div 
                                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] aspect-[9/16] rounded-3xl overflow-hidden border-2 border-white shadow-2xl bg-slate-50 select-none z-20 cursor-pointer"
                                    style={{ rotate: 1 }}
                                    whileHover={{ scale: 1.04, rotate: 0, zIndex: 30 }}
                                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                >
                                    <Link href={`/templates/${templates[1].slug}`} className="absolute inset-0 block">
                                        <video
                                            ref={mainVideoRef}
                                            src={templates[1].preview_url}
                                            autoPlay
                                            loop
                                            muted={muted}
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
                                    </Link>
                                    
                                    {/* Mute button on main card */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setMuted(m => !m); }}
                                        className="absolute top-4 right-4 w-7.5 h-7.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-all z-35 active:scale-90"
                                        title={muted ? "Unmute Showcase Audio" : "Mute Showcase Audio"}
                                    >
                                        {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                    </button>

                                    <div className="absolute bottom-4 left-4 right-4 text-white z-10 pointer-events-none">
                                        <span className="inline-block text-[8px] font-extrabold uppercase tracking-widest text-rose-300 bg-rose-500/10 border border-rose-400/20 px-2 py-0.5 rounded mb-1.5 backdrop-blur-sm">
                                            Featured Design
                                        </span>
                                        <p className="text-xs font-bold truncate">{templates[1].title}</p>
                                    </div>
                                </motion.div>

                            </div>
                        ) : (
                            <div className="w-72 h-96 rounded-2xl bg-slate-50 border border-slate-200/80 animate-pulse flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </section>
    );
};

export default Hero;
