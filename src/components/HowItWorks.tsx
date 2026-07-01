"use client";

import React from "react";
import { motion } from "framer-motion";
import { MousePointerClick, Sliders, Film, ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
    {
        number: "01",
        title: "Choose Template",
        description: "Browse our curated gallery of premium, designer-made motion wedding templates.",
        icon: MousePointerClick,
        color: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
        number: "02",
        title: "Personalize Details",
        description: "Add names, event details, and upload photos. Crop and adjust layouts instantly.",
        icon: Sliders,
        color: "text-indigo-600 bg-indigo-50 border-indigo-100",
    },
    {
        number: "03",
        title: "Render & Share",
        description: "Export in ultra high definition and instantly download or share with your guests.",
        icon: Film,
        color: "text-rose-600 bg-rose-50 border-rose-100",
    },
];

const HowItWorks = () => {
    return (
        <section className="py-20 bg-slate-50/50 border-t border-slate-100 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-650 bg-indigo-50 border border-indigo-100/50 px-3 py-1.5 rounded-full">
                        SIMPLE PROCESS
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-5 mb-4">
                        How CelitePro Works
                    </h2>
                    <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                        Create studio-quality motion invitations in three simple steps. No design experience required.
                    </p>
                </div>

                {/* Steps Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {/* Background Connector Line for desktop */}
                    <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-[1px] bg-slate-200/60 -translate-y-12 -z-10" />

                    {steps.map((step, idx) => {
                        const Icon = step.icon;
                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: idx * 0.15 }}
                                className="group relative bg-white border border-slate-200/80 rounded-2xl p-8 hover:shadow-lg hover:shadow-slate-200/40 hover:border-slate-300 transition-all duration-300 flex flex-col items-center text-center"
                            >
                                {/* Step Number Label */}
                                <div className="absolute top-4 right-6 text-3xl font-black text-slate-100 group-hover:text-indigo-50 select-none transition-colors">
                                    {step.number}
                                </div>

                                {/* Icon Wrapper */}
                                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-6 shadow-sm ${step.color} transition-transform group-hover:scale-110 duration-300`}>
                                    <Icon className="w-6 h-6" />
                                </div>

                                {/* Title & Text */}
                                <h3 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-indigo-650 transition-colors">
                                    {step.title}
                                </h3>
                                <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-[240px]">
                                    {step.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Bottom Callout Link */}
                <div className="flex justify-center mt-12">
                    <Link
                        href="/templates"
                        className="group inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-755 transition-all hover:underline"
                    >
                        Browse all premium templates
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>

            </div>
        </section>
    );
};

export default HowItWorks;
