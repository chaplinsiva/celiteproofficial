"use client";

import React from "react";
import { motion } from "framer-motion";
import { Scale, CheckCircle, AlertCircle, HelpCircle } from "lucide-react";

const TermsPage = () => {
    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-20">
            <div className="container mx-auto px-4 max-w-4xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <Scale className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms & Conditions</h1>
                    <p className="text-gray-400">Last updated: January 31, 2026</p>
                </motion.div>

                <div className="space-y-12 text-gray-300 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-indigo-400" /> 1. Acceptance of Terms
                        </h2>
                        <p>
                            By accessing or using CelitePro, you agree to be bound by these Terms and
                            Conditions. If you do not agree to all of these terms, do not use our service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <AlertCircle className="w-6 h-6 text-indigo-400" /> 2. Use License
                        </h2>
                        <p className="mb-4">
                            CelitePro grants you a limited, non-exclusive, non-transferable license
                            to use our video editing tools and templates for your personal or
                            commercial projects, subject to the folgende terms:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>You may not redistribute our templates in their raw form.</li>
                            <li>You are responsible for the content you create and upload.</li>
                            <li>Subscription plans have specific download and rendering limits.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <HelpCircle className="w-6 h-6 text-indigo-400" /> 3. Payments and Refunds
                        </h2>
                        <p>
                            Payments are processed securely via Razorpay. Subscriptions are billed on
                            a recurring basis unless cancelled. Refunds are handled on a case-by-case
                            basis according to our refund policy.
                        </p>
                    </section>

                    <div className="p-8 bg-white/5 border border-white/10 rounded-2xl mt-16">
                        <p className="text-sm text-gray-500">
                            CelitePro reserves the right to modify these terms at any time.
                            Continued use of the service constitutes acceptance of updated terms.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsPage;
