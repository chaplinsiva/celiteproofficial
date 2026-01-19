"use client";

import React from "react";
import { motion } from "framer-motion";
import { Play, Zap, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";

const Hero = () => {
    return (
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0A0A0B] pt-20">
            {/* Background Glows */}
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-sm font-medium mb-6">
                        <Sparkles className="w-4 h-4" />
                        <span>Professional Video Editor tool</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
                        The Ultimate <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                            Video Editor tool
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-base md:text-lg text-gray-400 mb-10 leading-relaxed px-4">
                        Create professional videos in seconds with our powerful Video Editor tool.
                        Pick a template, customize your assets, and get stunning results instantly.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/signup">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-8 py-4 bg-white text-black font-bold rounded-2xl flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                            >
                                Start Creating Free
                                <Zap className="w-4 h-4 fill-current" />
                            </motion.button>
                        </Link>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="px-8 py-4 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2"
                        >
                            Watch Demo
                            <Play className="w-4 h-4 fill-current" />
                        </motion.button>
                    </div>
                </motion.div>

                {/* Visual Preview - Featuring Thalaivaru Kalavaramey */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="mt-20 relative px-4"
                >
                    <div className="relative mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm overflow-hidden shadow-2xl">
                        <div className="aspect-video bg-black/40 rounded-2xl overflow-hidden relative group">
                            {/* In a real scenario, this would be a high-quality video or image */}
                            <div className="absolute inset-x-0 bottom-0 p-8 z-20 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col items-center sm:items-start text-center sm:text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-4">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Trending Now</span>
                                </div>
                                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2">Thalaivaru Kalavaramey</h2>
                                <p className="text-gray-400 text-sm mb-6 max-w-md">Professional cinematic intro for the ultimate entrance. Fully customizable in seconds.</p>
                                <Link href="/templates/thalaivaru-kalavaramey-title-card">
                                    <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(79,70,229,0.4)] group/btn">
                                        Edit This Template
                                        <Wand2 className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" />
                                    </button>
                                </Link>
                            </div>

                            {/* Decorative Preview Element */}
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 transition-transform group-hover:scale-105 duration-700">
                                <Play className="w-20 h-20 text-white/10 fill-current" />
                            </div>

                            {/* Floating UI Badges */}
                            <div className="absolute top-8 right-8 flex flex-col gap-3">
                                <div className="px-4 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-tight">Render Ready</span>
                                </div>
                                <div className="px-4 py-2 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 flex items-center gap-2">
                                    <Play className="w-3 h-3 text-indigo-400 fill-current" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-tight">15s Duration</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Decorative bits */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/30 rounded-full blur-[60px]" />
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-600/30 rounded-full blur-[60px]" />
                </motion.div>
            </div>
        </section>
    );
};

export default Hero;
