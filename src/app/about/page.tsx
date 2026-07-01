"use client";

import React from "react";
import { motion } from "framer-motion";
import { Users, Rocket, Heart, Trophy, Zap } from "lucide-react";

const team = [
    {
        name: "Thavasiva",
        role: "Founder & CEO",
        description: "The visionary architect leading CelitePro's mission to democratize video creation.",
        gradient: "from-blue-600 to-cyan-500",
        icon: Rocket
    },
    {
        name: "Sreram",
        role: "Co-founder & CTO",
        description: "The technical powerhouse turning complex rendering problems into elegant solutions.",
        gradient: "from-purple-600 to-indigo-500",
        icon: Zap
    },
    {
        name: "Anandhakumaran",
        role: "Co-founder & CFO",
        description: "The strategic mind ensuring CelitePro's sustainable growth and financial health.",
        gradient: "from-amber-500 to-orange-600",
        icon: Trophy
    },
    {
        name: "Karthikeyan",
        role: "Co-founder & COO",
        description: "The operational glue keeping every gear in the CelitePro machine turning smoothly.",
        gradient: "from-rose-500 to-pink-600",
        icon: Heart
    }
];

const SoftGradientBackground = () => {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-50/50 rounded-full blur-[100px]" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-rose-50/30 rounded-full blur-[120px]" />
            <div className="absolute top-1/2 right-10 w-80 h-80 bg-indigo-50/40 rounded-full blur-[80px]" />
        </div>
    );
};

const AboutPage = () => {
    return (
        <div className="min-h-screen bg-white text-slate-800 pt-32 pb-20 relative selection:bg-indigo-500/10">
            <SoftGradientBackground />

            {/* Hero Section */}
            <section className="container mx-auto px-4 relative mb-40 lg:mb-60">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-indigo-600/5 blur-[150px] rounded-full -z-10" />

                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-5xl mx-auto text-center relative z-10"
                >
                    <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-block px-4 py-1.5 rounded-full bg-indigo-50/85 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-8"
                    >
                        Our Eternity Story
                    </motion.span>
                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold mb-8 leading-[0.9] tracking-tighter text-slate-900">
                        Four Friends. <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500">
                            One Vision.
                        </span>
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-500 leading-relaxed max-w-3xl mx-auto font-medium">
                        Our journey didn't start in a boardroom. It started in a school classroom
                        during 11th grade. From teenage dreams to a global video automation revolution.
                    </p>
                </motion.div>
            </section>

            {/* Cinematic Storyline */}
            <section className="container mx-auto px-4 mb-60 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-start">
                        {/* Timeline Column */}
                        <div className="space-y-32 relative">
                            {/* Line connecting points */}
                            <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-gradient-to-b from-indigo-200 to-transparent lg:left-1/2 lg:-translate-x-1/2 opacity-40" />

                            {[
                                {
                                    year: "2021",
                                    title: "The Chaplin Era",
                                    icon: Heart,
                                    color: "rose",
                                    text: "At age 16, while others were focused on exams, we built our first legacy: the Chaplin brand. A playground of innovation where school dreams met real-world ambition."
                                },
                                {
                                    year: "2023",
                                    title: "Forged in Fire",
                                    icon: Zap,
                                    color: "amber",
                                    text: "The transition to 'Celite'. A period of relentless growth, pivoting through challenges, and refining our technical edge to solve the impossible."
                                },
                                {
                                    year: "2025",
                                    title: "CelitePro Expansion",
                                    icon: Rocket,
                                    color: "indigo",
                                    text: "The global launch. Taking everything we learned from Chaplin and Celite to democratize high-end video automation for creators everywhere."
                                }
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true, margin: "-100px" }}
                                    className={`relative flex items-center lg:justify-between group ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center relative z-10 shrink-0 lg:absolute lg:left-1/2 lg:-translate-x-1/2 group-hover:border-indigo-500 transition-colors">
                                        <item.icon className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div className={`pl-12 lg:pl-0 lg:w-[45%] ${i % 2 === 0 ? 'lg:text-right' : 'lg:text-left'}`}>
                                        <span className={`text-5xl font-black text-slate-100 group-hover:text-slate-200/80 transition-colors`}>{item.year}</span>
                                        <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.title}</h3>
                                        <p className="text-slate-500 leading-relaxed text-sm lg:text-base">{item.text}</p>
                                    </div>
                                    <div className="hidden lg:block lg:w-[45%]" />
                                </motion.div>
                            ))}
                        </div>

                        {/* Visual Column */}
                        <div className="sticky top-40 hidden lg:block">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                className="relative aspect-[4/5] rounded-[2.5rem] overflow-hidden border border-slate-200/80 p-2 bg-slate-50/50 backdrop-blur-3xl shadow-sm"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-transparent" />
                                <img
                                    src="/logo.png"
                                    className="w-full h-full object-contain opacity-70 group-hover:scale-110 transition-transform duration-[2s]"
                                    alt="CelitePro Cinematic"
                                />
                                <div className="absolute bottom-8 left-8 right-8 p-8 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-md">
                                    <p className="text-sm font-medium text-slate-650 italic">
                                        "Work hard in silence, let your success be your noise."
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Team Grid: Enhanced Glassmorphism */}
            <section className="container mx-auto px-4 mb-60 relative">
                <div className="text-center mb-24">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-6xl font-bold text-slate-900 mb-6"
                    >
                        The Brotherhood.
                    </motion.h2>
                    <p className="text-slate-500 max-w-xl mx-auto">The four pillars of CelitePro. Friends for life, founders for a reason.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {team.map((member, index) => (
                        <motion.div
                            key={member.name}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="group relative p-1 rounded-[2rem] bg-slate-50/60 border border-slate-200/80 hover:border-slate-350 transition-all hover:bg-white hover:shadow-xl flex flex-col items-center text-center overflow-hidden"
                        >
                            <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${member.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />

                            <div className="p-10 flex flex-col items-center">
                                <div className={`w-20 h-20 rounded-[1.5rem] bg-gradient-to-br ${member.gradient} mb-8 flex items-center justify-center shadow-2xl relative`}>
                                    <div className="absolute inset-0 rounded-[1.5rem] blur-2xl opacity-20 bg-inherit" />
                                    <member.icon className="w-10 h-10 text-white relative z-10" />
                                </div>

                                <h3 className="text-2xl font-bold text-slate-900 mb-2">{member.name}</h3>
                                <p className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] mb-6">{member.role}</p>
                                <p className="text-slate-500 text-sm leading-relaxed group-hover:text-slate-700 transition-colors">
                                    {member.description}
                                </p>
                            </div>

                            {/* Decorative background number */}
                            <span className="absolute bottom-[-20%] right-[-10%] text-[10rem] font-black text-slate-200/30 pointer-events-none group-hover:text-slate-300/40 transition-colors leading-none">
                                {index + 1}
                            </span>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Final CTA: Cinematic Conclusion */}
            <section className="container mx-auto px-4 pb-20">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.5 }}
                    className="relative rounded-[3.5rem] overflow-hidden bg-slate-50/50 border border-slate-200/80 p-12 md:p-32 text-center group shadow-sm"
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/5 via-purple-600/2 to-transparent pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(255,255,255,0.05)_100%)]" />

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        className="relative z-10"
                    >
                        <h2 className="text-4xl md:text-7xl font-bold text-slate-900 mb-10 tracking-tight">
                            Our story never ends. <br />
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500">It evolves with you.</span>
                        </h2>
                        <p className="text-slate-550 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-12">
                            This is only the beginning. We're here to redefine the future of
                            digital creativity, together with the world.
                        </p>

                        <div className="flex flex-wrap justify-center gap-12 opacity-50 group-hover:opacity-100 transition-all duration-700">
                            <Rocket className="w-8 h-8 text-indigo-500" />
                            <Trophy className="w-8 h-8 text-purple-500" />
                            <Heart className="w-8 h-8 text-rose-500" />
                            <Zap className="w-8 h-8 text-amber-500" />
                        </div>
                    </motion.div>
                </motion.div>
            </section>
        </div>
    );
};

export default AboutPage;
