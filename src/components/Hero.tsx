"use client";

import React from "react";
import Link from "next/link";

const Hero = () => {
    return (
        <section className="relative py-20 lg:py-24 bg-[#0A0A0B]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                    Automate Your <span className="text-indigo-400">Video Workflow</span>
                </h1>
                
                <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
                    Create studio-quality videos at scale. Integrate professional After Effects
                    templates directly into your apps or customize them in seconds.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link 
                        href="/templates" 
                        className="px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        Explore Templates
                    </Link>
                    <Link 
                        href="/templates" 
                        className="px-8 py-3 bg-white/5 text-white font-semibold rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        View API
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default Hero;
