"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Layers, Play, Edit3, ArrowRight, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

interface Template {
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

const TemplateCard = ({ template, index }: { template: Template; index: number }) => {
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
            transition={{ duration: 0.5, delay: index * 0.05 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-350/80 flex flex-col justify-between h-full w-full"
        >
            <div className="relative aspect-[16/10] bg-slate-50 overflow-hidden shrink-0">
                {/* Base Thumbnail */}
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
                        className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-350"
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
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/50 rounded-full text-[9px] font-bold uppercase tracking-wider text-indigo-650">
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
};

const TemplateListing = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch("/api/admin/templates");
            const data = await res.json();
            const fetched = data.templates || [];

            // 8 gorgeous custom high-end fallbacks with Unsplash & Mixkit previews
            const fallbacks: Template[] = [
                {
                    id: "fb-1",
                    slug: "floral-classic",
                    title: "Elegant Floral Watercolor",
                    category: "Classic Invitation",
                    duration: "15s",
                    thumbnail_url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-beautiful-bride-posing-in-front-of-a-mirror-42171-large.mp4",
                    image_placeholders: [{ key: "img-1" }, { key: "img-2" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }, { key: "txt-3" }],
                    credit_cost: 20
                },
                {
                    id: "fb-2",
                    slug: "royal-gold",
                    title: "Royal Golden Monogram",
                    category: "Luxury Monogram",
                    duration: "20s",
                    thumbnail_url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-newlywed-couple-with-their-rings-42183-large.mp4",
                    image_placeholders: [{ key: "img-1" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }],
                    credit_cost: 25
                },
                {
                    id: "fb-3",
                    slug: "minimal-modern",
                    title: "Minimalist Modern Typography",
                    category: "Modern Invitation",
                    duration: "12s",
                    thumbnail_url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-wedding-rings-lying-on-a-surface-42180-large.mp4",
                    image_placeholders: [{ key: "img-1" }, { key: "img-2" }, { key: "img-3" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }, { key: "txt-3" }, { key: "txt-4" }],
                    credit_cost: 15
                },
                {
                    id: "fb-4",
                    slug: "watercolor-blossom",
                    title: "Watercolor Cherry Blossom",
                    category: "Artistic Painting",
                    duration: "18s",
                    thumbnail_url: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-wedding-details-bride-putting-on-shoes-42173-large.mp4",
                    image_placeholders: [{ key: "img-1" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }, { key: "txt-3" }],
                    credit_cost: 20
                },
                {
                    id: "fb-5",
                    slug: "floral-sparkles",
                    title: "Golden Floral Sparkles",
                    category: "Golden Floral",
                    duration: "14s",
                    thumbnail_url: "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-wedding-rings-on-a-flower-bed-42179-large.mp4",
                    image_placeholders: [{ key: "img-1" }, { key: "img-2" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }],
                    credit_cost: 20
                },
                {
                    id: "fb-6",
                    slug: "modern-champagne",
                    title: "Modern Champagne Toast",
                    category: "Modern Chic",
                    duration: "16s",
                    thumbnail_url: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-married-couple-holding-a-glass-of-champagne-42185-large.mp4",
                    image_placeholders: [{ key: "img-1" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }, { key: "txt-3" }],
                    credit_cost: 22
                },
                {
                    id: "fb-7",
                    slug: "wedding-dance",
                    title: "First Dance Silhouette",
                    category: "Luxury Silhouette",
                    duration: "22s",
                    thumbnail_url: "https://images.unsplash.com/photo-1507504038482-762efc37cf3b?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-newlyweds-slow-dancing-at-their-wedding-42177-large.mp4",
                    image_placeholders: [{ key: "img-1" }, { key: "img-2" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }],
                    credit_cost: 25
                },
                {
                    id: "fb-8",
                    slug: "bridesmaid-glam",
                    title: "Bridesmaid Glamour Vintage",
                    category: "Vintage Grace",
                    duration: "15s",
                    thumbnail_url: "https://images.unsplash.com/photo-1519225495810-7512c696505a?auto=format&fit=crop&q=80&w=600",
                    preview_url: "https://assets.mixkit.co/videos/preview/mixkit-bride-putting-on-a-veil-with-her-bridesmaids-42174-large.mp4",
                    image_placeholders: [{ key: "img-1" }],
                    text_placeholders: [{ key: "txt-1" }, { key: "txt-2" }, { key: "txt-3" }, { key: "txt-4" }],
                    credit_cost: 18
                }
            ];

            if (fetched.length === 0) {
                setTemplates(fallbacks);
            } else if (fetched.length < 8) {
                setTemplates([...fetched, ...fallbacks.slice(0, 8 - fetched.length)]);
            } else {
                setTemplates(fetched.slice(0, 8));
            }
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="templates" className="py-24 bg-white border-t border-slate-100 relative overflow-hidden">
            {/* Ambient background sparkles */}
            <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-rose-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100/50 text-indigo-650 text-xs font-bold tracking-wide mb-4">
                            <Layers className="w-3.5 h-3.5" />
                            <span>BESTSELLING COLLECTION</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                            Elegant Motion Templates
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                            Explore our premium, designer-curated motion cards. Hover over any design to watch the preview.
                        </p>
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-28">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-200/60 max-w-md mx-auto">
                        <Layers className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-800">No Templates Available</p>
                        <p className="text-xs text-slate-400 mt-1">Check back later or configure templates in the admin panel.</p>
                    </div>
                ) : (
                    <div className="relative w-full">
                        {/* Two Rows of Four Columns Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {templates.map((template, idx) => (
                                <TemplateCard 
                                    key={template.id} 
                                    template={template} 
                                    index={idx} 
                                />
                            ))}
                        </div>

                        {/* Centered CTA "Explore All" Button */}
                        <div className="flex justify-center mt-14">
                            <Link
                                href="/templates"
                                className="group inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold rounded-2xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Explore All Designs
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                )}

            </div>
        </section>
    );
};

export default TemplateListing;
