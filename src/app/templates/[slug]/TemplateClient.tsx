"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Sparkles, Clock, Layers, Share2, Edit3, ArrowLeft, Image as ImageIcon, Type, User, Check, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface ImagePlaceholder {
    key: string;
    label: string;
    aspectRatio: string;
}

interface TextPlaceholder {
    key: string;
    label: string;
    defaultValue: string;
}

interface Template {
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    duration: string;
    aspect_ratio: string;
    preview_url: string;
    thumbnail_url: string;
    image_placeholders: ImagePlaceholder[];
    text_placeholders: TextPlaceholder[];
}

interface RelatedTemplate {
    id: string;
    slug: string;
    title: string;
    category: string;
    duration: string;
    thumbnail_url: string;
    preview_url?: string;
    image_placeholders: { key: string }[];
    text_placeholders: { key: string }[];
    credit_cost: number;
    is_premium?: boolean;
}

function RelatedTemplateCard({ template, index }: { template: RelatedTemplate; index: number }) {
    const [isHovered, setIsHovered] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            if (isHovered) {
                videoRef.current.load();
                videoRef.current.play().catch(() => {});
            } else {
                videoRef.current.pause();
            }
        }
    }, [isHovered]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-300/80 flex flex-col justify-between h-full w-full"
        >
            <div className="relative aspect-[16/10] bg-slate-50 overflow-hidden shrink-0">
                {template.thumbnail_url ? (
                    <img
                        src={template.thumbnail_url}
                        alt={template.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center">
                        <Play className="w-8 h-8 text-slate-300" />
                    </div>
                )}

                {/* Hover Video Loop */}
                {template.preview_url && isHovered && (
                    <video
                        ref={videoRef}
                        src={template.preview_url}
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300"
                    />
                )}

                {/* Status overlays */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-20 pointer-events-none">
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[9px] font-bold text-white rounded border border-white/10 flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-2.5 h-2.5 text-rose-300" />
                        {template.credit_cost ?? 20} Credits
                    </span>
                    {template.duration && (
                        <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[9px] font-bold text-white rounded border border-white/10 shadow-sm">
                            {template.duration}
                        </span>
                    )}
                </div>
                {template.is_premium && (
                    <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
                        <span className="px-2 py-0.5 bg-amber-500/90 backdrop-blur-md text-[9px] font-bold text-white rounded border border-amber-400/30 shadow-sm flex items-center gap-1">
                            ⭐ Premium
                        </span>
                    </div>
                )}

                <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-4 h-4 text-slate-800 fill-current ml-0.5" />
                    </div>
                </div>
            </div>

            {/* Info and Customize Link */}
            <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/50 rounded-full text-[9px] font-bold uppercase tracking-wider text-indigo-600">
                            {template.category}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400">
                            {template.image_placeholders?.length || 0} Img • {template.text_placeholders?.length || 0} Txt
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-5 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {template.title}
                    </h3>
                </div>

                <Link
                    href={`/templates/${template.slug}`}
                    className="w-full py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all hover:bg-slate-900 hover:border-slate-900 hover:text-white hover:shadow-sm"
                >
                    <Edit3 className="w-3.5 h-3.5" />
                    Customize Invitation
                </Link>
            </div>
        </motion.div>
    );
}

export default function TemplateClient({ template, relatedTemplates = [] }: { template: Template; relatedTemplates?: RelatedTemplate[] }) {
    const router = useRouter();
    const [showAlert, setShowAlert] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    // Auth form state
    const [authMode, setAuthMode] = React.useState<'signup' | 'login'>('signup');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [fullName, setFullName] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (authMode === 'signup') {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } },
            });

            if (error) {
                setError(error.message);
                setLoading(false);
            } else if (data.session) {
                // Auto-confirmed
                router.push(`/templates/${template.slug}/editor/${template.id}`);
            } else {
                // Confirmation required
                alert("Check your email for confirmation!");
                setShowAlert(false);
            }
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message);
                setLoading(false);
            } else {
                router.push(`/templates/${template.slug}/editor/${template.id}`);
            }
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/templates/${template.slug}/editor/${template.id}`,
            },
        });
        if (error) {
            setError(error.message);
            setLoading(false);
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: `${template.title} | CelitePro`,
            text: template.description || `Check out this professional video template: ${template.title}`,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error("Error sharing:", err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error("Error copying to clipboard:", err);
            }
        }
    };

    return (
        <main className="min-h-screen bg-white relative">

            <AnimatePresence>
                {showAlert && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="bg-white border border-slate-200/80 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl overflow-y-auto max-h-[90vh]"
                        >
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center mb-4">
                                    <User className="w-6 h-6 text-blue-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-1">
                                    {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
                                </h3>
                                <p className="text-slate-500 text-sm">
                                    {authMode === 'signup' ? 'Sign up to customize and render videos.' : 'Login to continue editing.'}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-semibold py-3 rounded-xl transition-all hover:bg-slate-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mb-6 text-sm"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Continue with Google
                            </button>

                            <div className="flex items-center gap-4 mb-6">
                                <div className="flex-1 h-px bg-slate-200/60"></div>
                                <span className="text-sm text-slate-400 font-medium">or continue with email</span>
                                <div className="flex-1 h-px bg-slate-200/60"></div>
                            </div>

                            <form onSubmit={handleAuth} className="space-y-4">
                                {authMode === 'signup' && (
                                    <div className="space-y-1.5 text-left">
                                        <label className="text-xs font-medium text-slate-500 ml-1 uppercase tracking-wider">Full Name</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="John Doe"
                                                required
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-850 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-medium text-slate-500 ml-1 uppercase tracking-wider">Email</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                        <input
                                            type="email"
                                            placeholder="you@example.com"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-850 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-left">
                                    <label className="text-xs font-medium text-slate-500 ml-1 uppercase tracking-wider">Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-11 text-slate-850 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg font-medium">
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 group disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            {authMode === 'signup' ? 'Create Account & Edit' : 'Log In & Edit'}
                                            <Check className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                                <p className="text-slate-500 text-sm mb-3">
                                    {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
                                </p>
                                <button
                                    onClick={() => {
                                        setAuthMode(authMode === 'signup' ? 'login' : 'signup');
                                        setError(null);
                                    }}
                                    className="text-blue-600 hover:text-blue-700 font-bold transition-colors"
                                >
                                    {authMode === 'signup' ? 'Log In Instead' : 'Create New Account'}
                                </button>

                                <button
                                    onClick={() => setShowAlert(false)}
                                    className="mt-6 block w-full text-xs text-slate-450 hover:text-slate-600 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24">
                <Link href="/templates" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 mb-8 transition-colors group font-medium">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Templates
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    {/* Left: Video Preview */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-6"
                    >
                        <div
                            className="bg-slate-50 rounded-3xl border border-slate-200/80 overflow-hidden relative group flex items-center justify-center"
                            style={{
                                aspectRatio: template.aspect_ratio
                                    ? template.aspect_ratio.replace(':', '/')
                                    : '16/9',
                                maxHeight: '75vh',
                            }}
                        >
                            {template.preview_url ? (
                                <video
                                    src={template.preview_url}
                                    className="w-full h-full object-contain"
                                    controls
                                    poster={template.thumbnail_url}
                                />
                            ) : template.thumbnail_url ? (
                                <img src={template.thumbnail_url} alt={template.title} className="w-full h-full object-contain" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="p-10 border-2 border-dashed border-slate-200/60 rounded-full">
                                        <Play className="w-12 h-12 text-blue-600 fill-current" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Placeholder Info Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50/50 border border-slate-200/70 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <ImageIcon className="w-4 h-4 text-purple-600" />
                                    <span className="text-xs font-bold text-slate-800 uppercase">Image Layers</span>
                                </div>
                                <div className="space-y-2">
                                    {template.image_placeholders?.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="text-slate-600">{p.label}</span>
                                            <span className="text-slate-400 font-mono font-medium">{p.aspectRatio}</span>
                                        </div>
                                    ))}
                                    {!template.image_placeholders?.length && (
                                        <span className="text-slate-400 text-xs">No image layers</span>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50/50 border border-slate-200/70 rounded-2xl">
                                <div className="flex items-center gap-2 mb-3">
                                    <Type className="w-4 h-4 text-emerald-600" />
                                    <span className="text-xs font-bold text-slate-800 uppercase">Text Layers</span>
                                </div>
                                <div className="space-y-2">
                                    {template.text_placeholders?.map((p, i) => (
                                        <div key={i} className="text-xs text-slate-600">{p.label}</div>
                                    ))}
                                    {!template.text_placeholders?.length && (
                                        <span className="text-slate-450 text-xs">No text layers</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right: Details */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-sm font-medium mb-6">
                            <Sparkles className="w-4 h-4" />
                            <span>{template.category}</span>
                        </div>

                        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
                            {template.title}
                        </h1>

                        <p className="text-slate-500 md:text-slate-600 text-base md:text-lg mb-10 leading-relaxed font-normal">
                            {template.description || "Elevate your brand with this high-quality motion graphic template. Fully customizable layers and brand-matching."}
                        </p>

                        <div className="grid grid-cols-3 gap-4 md:gap-8 mb-10">
                            <div className="flex flex-col items-center sm:items-start sm:flex-row gap-2 sm:gap-3 text-center sm:text-left">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                </div>
                                <div>
                                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-bold">Duration</div>
                                    <div className="text-sm sm:text-base text-slate-800 font-semibold">{template.duration || "N/A"}</div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center sm:items-start sm:flex-row gap-2 sm:gap-3 text-center sm:text-left">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center shrink-0">
                                    <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                                </div>
                                <div>
                                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-bold">Layers</div>
                                    <div className="text-sm sm:text-base text-slate-800 font-semibold">
                                        {(template.image_placeholders?.length || 0) + (template.text_placeholders?.length || 0)} Assets
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center sm:items-start sm:flex-row gap-2 sm:gap-3 text-center sm:text-left">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                                </div>
                                <div>
                                    <div className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-bold">Cost</div>
                                    <div className="text-sm sm:text-base text-amber-600 font-bold">
                                        {(template as any).credit_cost ?? 20} Credits
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-200/60">
                            <button
                                onClick={async () => {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    if (!session) {
                                        setShowAlert(true);
                                        return;
                                    }
                                    router.push(`/templates/${template.slug}/editor/${template.id}`);
                                }}
                                className="flex-1 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all group"
                            >
                                <Edit3 className="w-5 h-5" />
                                Edit in Editor
                            </button>
                            <button
                                onClick={handleShare}
                                className="px-8 py-4 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-850 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all"
                            >
                                {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Share2 className="w-5 h-5" />}
                                {copied ? "Copied!" : "Share"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── Related Templates Section ─────────────────────────────── */}
            {relatedTemplates.length > 0 && (
                <section className="border-t border-slate-100 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <motion.h2
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    className="text-2xl sm:text-3xl font-bold text-slate-900"
                                >
                                    You May Also Like
                                </motion.h2>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.1 }}
                                    className="text-slate-500 mt-2 text-sm sm:text-base"
                                >
                                    Explore more {template.category} templates
                                </motion.p>
                            </div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 }}
                            >
                                <Link
                                    href="/templates"
                                    className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all group"
                                >
                                    View All Templates
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                            </motion.div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {relatedTemplates.map((t, i) => (
                                <RelatedTemplateCard key={t.id} template={t} index={i} />
                            ))}
                        </div>

                        {/* Mobile "View All" link */}
                        <div className="mt-8 text-center sm:hidden">
                            <Link
                                href="/templates"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all group"
                            >
                                View All Templates
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </section>
            )}
        </main>
    );
}
