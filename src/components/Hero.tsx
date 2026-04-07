"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Play, Volume2, VolumeX } from "lucide-react";

interface Template {
    id: string;
    slug: string;
    title: string;
    category: string;
    preview_url: string;
    thumbnail_url: string;
}

const HERO_TEMPLATE_LIMIT = 6;

const Hero = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [muted, setMuted] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        fetch("/api/admin/templates")
            .then(r => r.json())
            .then(d => {
                const withVideo = (d.templates || []).filter((t: Template) => t.preview_url);
                const randomized = [...withVideo].sort(() => Math.random() - 0.5);
                setTemplates(randomized.slice(0, HERO_TEMPLATE_LIMIT));
            })
            .catch(() => { });
    }, []);

    // Auto-advance every 6 seconds
    useEffect(() => {
        if (templates.length < 2) return;
        const timer = setInterval(() => {
            setActiveIndex(i => (i + 1) % templates.length);
        }, 6000);
        return () => clearInterval(timer);
    }, [templates.length]);

    // Reset video when active changes
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.load();
            videoRef.current.play().catch(() => { });
        }
    }, [activeIndex]);

    const active = templates[activeIndex];
    const dots = templates.slice(0, HERO_TEMPLATE_LIMIT);

    return (
        <section className="relative min-h-screen flex items-center bg-[#0A0A0B] overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/8 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_50%,transparent_100%)]" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-24 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                    {/* LEFT — Text Content */}
                    <div className="max-w-xl">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-8 backdrop-blur-md"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Next-Gen Video Template Maker
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight"
                        >
                            Create Your{" "}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
                                Perfect Video
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-lg text-gray-400 mb-10 leading-relaxed"
                        >
                            Create premium, studio-quality videos, intros, and slideshows in minutes. Customize our elegant motion templates directly in our next-gen editor.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-col sm:flex-row items-start gap-4"
                        >
                            <Link
                                href="/pricing"
                                className="group relative px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-indigo-50 transition-all flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                            >
                                View Plans
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>

                            <Link
                                href="/templates"
                                className="px-8 py-4 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-all flex items-center gap-3 backdrop-blur-sm"
                            >
                                <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                    <Play className="w-3 h-3 fill-current text-indigo-400" />
                                </div>
                                Browse Templates
                            </Link>
                        </motion.div>

                        {/* Dot indicators */}
                        {templates.length > 1 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="flex items-center gap-2 mt-10"
                            >
                                {dots.map((t, i) => (
                                    <button
                                        key={t.id}
                                        onClick={() => setActiveIndex(i)}
                                        className={`transition-all rounded-full ${i === activeIndex
                                            ? "w-6 h-2 bg-indigo-400"
                                            : "w-2 h-2 bg-white/20 hover:bg-white/40"
                                            }`}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </div>

                    {/* RIGHT — Video Showcase */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="relative"
                    >
                        <div className="relative rounded-3xl overflow-hidden bg-black border border-white/10 shadow-[0_0_80px_rgba(99,102,241,0.15)] aspect-video w-full">

                            {/* Shimmer while no templates */}
                            {templates.length === 0 && (
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent animate-pulse flex items-center justify-center">
                                    <Play className="w-16 h-16 text-white/10" />
                                </div>
                            )}

                            {/* Video */}
                            <AnimatePresence mode="wait">
                                {active && (
                                    <motion.div
                                        key={active.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="absolute inset-0"
                                    >
                                        <video
                                            ref={videoRef}
                                            src={active.preview_url}
                                            autoPlay
                                            loop
                                            muted={muted}
                                            playsInline
                                            className="w-full h-full object-cover"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Mute toggle */}
                            <button
                                onClick={() => setMuted(m => !m)}
                                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all"
                            >
                                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </button>

                            {/* Minimal live dot */}
                            <div className="absolute top-4 left-4">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse block" />
                            </div>
                        </div>

                        {/* Decorative glow behind video */}
                        <div className="absolute inset-0 -z-10 bg-indigo-500/20 blur-[60px] rounded-3xl scale-90 translate-y-4" />
                    </motion.div>

                </div>
            </div>
        </section>
    );
};

export default Hero;
