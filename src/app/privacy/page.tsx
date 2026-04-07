"use client";

import React from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Eye, FileText } from "lucide-react";

const PrivacyPage = () => {
    return (
        <div className="min-h-screen bg-black text-white pt-32 pb-20">
            <div className="container mx-auto px-4 max-w-4xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <Shield className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
                    <p className="text-gray-400">Last updated: January 31, 2026</p>
                </motion.div>

                <div className="space-y-12 text-gray-300 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <Eye className="w-6 h-6 text-indigo-400" /> 1. Information We Collect
                        </h2>
                        <p className="mb-4">
                            CelitePro collects information to provide better services to all our users.
                            The types of information we collect include:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>Account Information: Email, name, and profile details when you sign up.</li>
                            <li>Usage Data: Information about how you use our video maker and templates.</li>
                            <li>Media Assets: Logos, images, and videos you upload for processing.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <Lock className="w-6 h-6 text-indigo-400" /> 2. How We Protect Your Data
                        </h2>
                        <p>
                            We use industry-standard encryption and security protocols (including TLS/SSL)
                            to ensure your data remains confidential and secure during transmission and storage.
                            Your media assets are stored in secure cloud environments with restricted access.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                            <FileText className="w-6 h-6 text-indigo-400" /> 3. Data Usage
                        </h2>
                        <p>
                            Your information is used solely to provide the services you request,
                            such as rendering videos, maintaining your project history, and
                            notifying you about your account or subscription status.
                            We never sell your data to third parties.
                        </p>
                    </section>

                    <div className="p-8 bg-white/5 border border-white/10 rounded-2xl mt-16">
                        <p className="text-sm text-gray-400">
                            If you have any questions about our Privacy Policy, please contact us at
                            <span className="text-indigo-400 ml-1 font-semibold">support@celitepro.com</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
