"use client";

import React, { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    Loader2, CheckCircle, XCircle, Download,
    ArrowLeft, RefreshCw, Share2, Copy, Check
} from "lucide-react";
import Link from "next/link";

interface RenderStatus {
    status: "queued" | "pending" | "processing" | "completed" | "failed";
    outputUrl?: string;
    error?: string;
    plainlyState?: string;
    queuePosition?: number;
    message?: string;
}

export default function RenderPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { id: renderJobId } = resolvedParams;

    const [status, setStatus] = useState<RenderStatus>({ status: "processing" });
    const [copied, setCopied] = useState(false);
    const [pollCount, setPollCount] = useState(0);

    useEffect(() => {
        if (status.status === "processing" || status.status === "pending" || status.status === "queued") {
            const interval = setInterval(() => {
                checkStatus();
                setPollCount((c) => c + 1);
            }, 3000);

            return () => clearInterval(interval);
        }
    }, [status.status]);

    useEffect(() => {
        checkStatus();
    }, [renderJobId]);

    const checkStatus = async () => {
        try {
            const res = await fetch(`/api/render/status?jobId=${renderJobId}`);
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            console.error("Status check error:", error);
        }
    };

    const copyToClipboard = () => {
        if (status.outputUrl) {
            navigator.clipboard.writeText(status.outputUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getProgressMessage = () => {
        if (status.plainlyState === "QUEUED") return "In queue...";
        if (status.plainlyState === "IN_PROGRESS") return "Rendering video...";
        if (status.plainlyState === "THROTTLED") return "Waiting for slot...";
        if (pollCount < 3) return "Initializing render...";
        if (pollCount < 10) return "Processing template...";
        return "Rendering your video...";
    };

    return (
        <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full"
            >
                {/* Queued State */}
                {status.status === "queued" && (
                    <div className="text-center">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
                                <div className="text-3xl font-bold text-amber-400">
                                    {status.queuePosition || "..."}
                                </div>
                            </div>
                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-amber-500/30"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            In Queue
                        </h1>
                        <p className="text-gray-400 mb-8">
                            {status.message || `Position ${status.queuePosition} in queue`}
                        </p>

                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Queue Position</span>
                                <span className="text-amber-400 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                    #{status.queuePosition}
                                </span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <p className="text-xs text-gray-500">
                                    Your render will start automatically when it reaches the front of the queue.
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-gray-600 mt-6">
                            This page will update automatically. You can leave and check back later.
                        </p>
                    </div>
                )}

                {/* Processing State */}
                {(status.status === "processing" || status.status === "pending") && (
                    <div className="text-center">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 mx-auto rounded-full bg-indigo-500/10 flex items-center justify-center">
                                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                            </div>
                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-indigo-500/30"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            Rendering Your Video
                        </h1>
                        <p className="text-gray-400 mb-8">
                            {getProgressMessage()}
                        </p>

                        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Status</span>
                                <span className="text-indigo-400 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                                    {status.plainlyState || "Processing"}
                                </span>
                            </div>
                            <div className="mt-4 h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                    animate={{ width: ["0%", "100%"] }}
                                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-gray-600 mt-6">
                            This may take a few minutes. You can leave this page and check back later.
                        </p>
                    </div>
                )}

                {/* Completed State */}
                {status.status === "completed" && status.outputUrl && (
                    <div className="text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center mb-8"
                        >
                            <CheckCircle className="w-12 h-12 text-emerald-400" />
                        </motion.div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            Video Ready!
                        </h1>
                        <p className="text-gray-400 mb-8">
                            Your video has been rendered successfully.
                        </p>

                        {/* Video Preview */}
                        <div className="mb-8 rounded-2xl overflow-hidden border border-white/10">
                            <video
                                src={status.outputUrl}
                                className="w-full aspect-video bg-black"
                                controls
                                autoPlay
                                muted
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <a
                                href={status.outputUrl}
                                download
                                className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.3)] transition-all"
                            >
                                <Download className="w-5 h-5" />
                                Download Video
                            </a>
                            <button
                                onClick={copyToClipboard}
                                className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                {copied ? "Copied!" : "Copy Link"}
                            </button>
                        </div>

                        <Link
                            href="/templates"
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-white mt-8 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Create Another Video
                        </Link>
                    </div>
                )}

                {/* Failed State */}
                {status.status === "failed" && (
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-8">
                            <XCircle className="w-12 h-12 text-red-400" />
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">
                            Render Failed
                        </h1>
                        <p className="text-gray-400 mb-8">
                            {status.error || "Something went wrong during rendering."}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => window.history.back()}
                                className="flex-1 px-6 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Try Again
                            </button>
                            <Link
                                href="/templates"
                                className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                Browse Templates
                            </Link>
                        </div>
                    </div>
                )}
            </motion.div>
        </main>
    );
}
