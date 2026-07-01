"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Play, Loader2 } from "lucide-react";
import Link from "next/link";

interface Template {
    id: string;
    slug: string;
    title: string;
    category: string;
    preview_url: string;
    thumbnail_url: string;
}

const ShowcaseCard = ({ item, index }: { item: Template; index: number }) => {
    const [isHovered, setIsHovered] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            if (isHovered) {
                video.muted = true;
                video.playsInline = true;
                video.load();
                video.play().catch((err) => {
                    console.log("Hover play failed/blocked:", err);
                });
            } else {
                video.pause();
            }
        }
    }, [isHovered]);

    // Staggered offsets & tilts for a premium asymmetric collage layout on desktop
    const collageStyles = [
        "lg:-rotate-2 lg:translate-y-3 hover:rotate-0 hover:-translate-y-2",
        "lg:rotate-3 lg:-translate-y-3 hover:rotate-0 hover:-translate-y-5",
        "lg:rotate-0 lg:scale-[1.03] z-20 shadow-xl lg:shadow-2xl border-2 border-white hover:scale-[1.06]",
        "lg:-rotate-3 lg:translate-y-5 hover:rotate-0 hover:translate-y-2",
        "lg:rotate-2 lg:-translate-y-1 hover:rotate-0 hover:-translate-y-3"
    ];

    return (
        <Link href={`/templates/${item.slug}`} className="block shrink-0 lg:shrink">
            <motion.div
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`group relative rounded-3xl overflow-hidden border border-slate-200/80 shadow-md bg-slate-900 min-w-[270px] sm:min-w-[310px] lg:min-w-0 w-[270px] sm:w-[310px] lg:w-auto aspect-square transition-all duration-500 cursor-pointer ${collageStyles[index % 5]}`}
                style={{
                    // Solves the browser-level overflow corner cutting bug during active transforms & transitions
                    transform: "translateZ(0)",
                    WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                    isolation: "isolate"
                }}
            >
                {/* Default Thumbnail Image */}
                {item.thumbnail_url ? (
                    <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 rounded-3xl"
                        style={{
                            WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                            transform: "translateZ(0)"
                        }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center rounded-3xl">
                        <Play className="w-10 h-10 text-slate-300" />
                    </div>
                )}

                {/* Hover Video Loop */}
                {item.preview_url && isHovered && (
                    <video
                        ref={videoRef}
                        src={item.preview_url}
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-350 rounded-3xl"
                        style={{
                            WebkitMaskImage: "-webkit-radial-gradient(white, black)",
                            transform: "translateZ(0)"
                        }}
                    />
                )}
                
                {/* Bottom Vignette Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none z-15 rounded-3xl" />

                {/* Text details overlay */}
                <div className="absolute bottom-5 left-5 right-5 text-white z-20 pointer-events-none">
                    <span className="inline-block text-[8px] font-extrabold uppercase tracking-widest text-rose-300 bg-rose-500/15 border border-rose-450/25 px-2.5 py-0.5 rounded-md mb-2 backdrop-blur-sm">
                        {item.category || "Invitation"}
                    </span>
                    <h3 className="text-sm font-bold truncate">
                        {item.title}
                    </h3>
                </div>
                
                {/* Hover play bubble */}
                <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 pointer-events-none">
                    <div className="w-11 h-11 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center scale-90 group-hover:scale-100 transition-transform shadow-lg">
                        <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

const VideoShowcase = () => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/admin/templates")
            .then(r => r.json())
            .then(d => {
                const fetched = (d.templates || []).filter((t: Template) => t.preview_url);

                // Premium high-res fallbacks with Unsplash thumbnails & Mixkit video previews
                const fallbacks: Template[] = [
                    {
                        id: "fb-sc-1",
                        slug: "floral-classic",
                        title: "Elegant Floral Watercolor",
                        category: "Classic",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-beautiful-bride-posing-in-front-of-a-mirror-42171-large.mp4",
                        thumbnail_url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600"
                    },
                    {
                        id: "fb-sc-2",
                        slug: "royal-gold",
                        title: "Royal Golden Monogram",
                        category: "Luxury",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-newlywed-couple-with-their-rings-42183-large.mp4",
                        thumbnail_url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=600"
                    },
                    {
                        id: "fb-sc-3",
                        slug: "minimal-modern",
                        title: "Minimalist Typography Invite",
                        category: "Modern",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-wedding-rings-lying-on-a-surface-42180-large.mp4",
                        thumbnail_url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&q=80&w=600"
                    },
                    {
                        id: "fb-sc-4",
                        slug: "watercolor-blossom",
                        title: "Watercolor Cherry Blossom",
                        category: "Watercolor",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-wedding-details-bride-putting-on-shoes-42173-large.mp4",
                        thumbnail_url: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&q=80&w=600"
                    },
                    {
                        id: "fb-sc-5",
                        slug: "wedding-dance",
                        title: "First Dance Silhouette",
                        category: "Celebration",
                        preview_url: "https://assets.mixkit.co/videos/preview/mixkit-newlyweds-slow-dancing-at-their-wedding-42177-large.mp4",
                        thumbnail_url: "https://images.unsplash.com/photo-1507504038482-762efc37cf3b?auto=format&fit=crop&q=80&w=600"
                    }
                ];

                if (fetched.length < 5) {
                    setTemplates([...fetched, ...fallbacks.slice(0, 5 - fetched.length)]);
                } else {
                    setTemplates(fetched.slice(0, 5));
                }
            })
            .catch(() => {
                // Keep default fallbacks on fetch failure
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return (
        <section className="py-28 bg-white border-t border-slate-100 relative overflow-hidden">
            {/* Ambient glows */}
            <div className="absolute top-1/4 left-10 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                
                {/* Section Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-100/50 text-rose-600 text-[10px] font-extrabold tracking-wide uppercase">
                        <Sparkles className="w-3.5 h-3.5 text-rose-500 animate-spin" style={{ animationDuration: '4s' }} />
                        <span>Visual Inspiration</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-5 mb-4">
                        Aesthetic Video Showcase
                    </h2>
                    <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                        Watch real-time invitation loops. Discover premium design motions crafted to tell your love story.
                    </p>
                </div>

                {/* Grid Collage (1:1 aspect ratios) */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-7 h-7 text-rose-500 animate-spin" />
                    </div>
                ) : (
                    <div className="flex flex-nowrap lg:grid lg:grid-cols-5 gap-6 overflow-x-auto lg:overflow-visible pb-12 pt-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth">
                        {templates.map((template, idx) => (
                            <ShowcaseCard 
                                key={template.id} 
                                item={template} 
                                index={idx} 
                            />
                        ))}
                    </div>
                )}

            </div>
        </section>
    );
};

export default VideoShowcase;
