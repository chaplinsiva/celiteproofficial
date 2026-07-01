"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-slate-50 border-t border-slate-200/60 pt-20 pb-10">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <Link href="/" className="flex items-center gap-2 mb-6">
                            <img
                                src="/logo.png"
                                alt="CelitePro Logo"
                                className="w-10 h-10 object-contain"
                            />
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500">
                                CelitePro
                            </span>
                        </Link>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-md">
                            The professional wedding invitation video maker.
                            Revolutionizing how the world creates video content through
                            automation and cinematic excellence.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-slate-900 font-semibold mb-6">Company</h3>
                        <ul className="space-y-4">
                            <li>
                                <Link href="/about" className="text-slate-500 hover:text-blue-600 transition-colors text-sm">
                                    Our Story
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="text-slate-500 hover:text-blue-600 transition-colors text-sm">
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link href="/templates" className="text-slate-500 hover:text-blue-600 transition-colors text-sm">
                                    Templates
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-slate-900 font-semibold mb-6">Legal</h3>
                        <ul className="space-y-4">
                            <li>
                                <Link href="/privacy" className="text-slate-500 hover:text-blue-600 transition-colors text-sm">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="text-slate-500 hover:text-blue-600 transition-colors text-sm">
                                    Terms & Conditions
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-200/60 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-slate-400 text-xs text-center md:text-left">
                        © {currentYear} CelitePro. All rights reserved.
                        Created with passion by school friends.
                    </p>
                    <div className="flex items-center gap-6">
                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest px-3 py-1 bg-slate-100 rounded-full border border-slate-200/60">
                            EST. 2025
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
