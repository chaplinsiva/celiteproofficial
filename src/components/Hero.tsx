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
                        <span>AI-Powered Video Automation</span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
                        Automate Your <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                            Video Workflow
                        </span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-base md:text-lg text-gray-400 mb-10 leading-relaxed px-4">
                        Create professional videos in seconds with our automated editing engine.
                        Connect your data, pick a template, and let CelitePro do the rest.
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

                {/* Visual Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="mt-20 relative px-4"
                >
                    <div className="relative mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm overflow-hidden shadow-2xl">
                        {/* Mock Editor UI */}
                        <div className="aspect-video bg-black/40 rounded-2xl overflow-hidden relative group">
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-all">
                                <div className="p-10 border-2 border-dashed border-white/20 rounded-full">
                                    <Wand2 className="w-12 h-12 text-indigo-400 animate-bounce" />
                                </div>
                            </div>
                            {/* Visual elements representing automation */}
                            <div className="absolute bottom-4 left-4 right-4 h-24 bg-white/5 rounded-xl border border-white/5 flex items-center p-4 gap-4">
                                <div className="w-20 h-full bg-indigo-500/20 rounded-lg animate-pulse" />
                                <div className="w-32 h-full bg-purple-500/20 rounded-lg animate-pulse delay-75" />
                                <div className="w-24 h-full bg-pink-500/20 rounded-lg animate-pulse delay-150" />
                                <div className="flex-1" />
                                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">100%</span>
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
