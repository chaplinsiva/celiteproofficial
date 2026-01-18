"use client";

import React, { use, useState, useRef, ChangeEvent, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Save, Download, Settings,
    Layers, Type, Image as LucideImage,
    Loader2, Sparkles, Upload, X, Crop as CropIcon, Check
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cropper, ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import { supabase } from "@/lib/supabase";

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
    preview_url: string;
    thumbnail_url: string;
    image_placeholders: ImagePlaceholder[];
    text_placeholders: TextPlaceholder[];
}

// Parse aspect ratio string to number and dimensions (supports "16:9", "1890:745", "1920x1080", etc.)
function parseAspectRatio(ratio: string): { ratio: number; width: number; height: number } {
    if (!ratio) return { ratio: 1, width: 1920, height: 1080 };

    // Handle "widthxheight" format (e.g., "1920x1080")
    if (ratio.toLowerCase().includes("x")) {
        const [w, h] = ratio.toLowerCase().split("x").map(Number);
        return { ratio: (w / h) || 1, width: w || 1920, height: h || 1080 };
    }

    // Handle "width:height" format (e.g., "16:9" or "1890:745")
    if (ratio.includes(":")) {
        const [w, h] = ratio.split(":").map(Number);
        const r = (w / h) || 1;

        // If the numbers look like actual pixel dimensions (at least one > 100), use them directly
        if (w > 100 || h > 100) {
            return { ratio: r, width: w, height: h };
        }

        // Otherwise treat as a simple ratio and scale to reasonable HD dimensions
        if (r >= 1) {
            return { ratio: r, width: 1920, height: Math.round(1920 / r) };
        } else {
            return { ratio: r, width: Math.round(1080 * r), height: 1080 };
        }
    }

    return { ratio: 1, width: 1920, height: 1080 };
}

export default function Editor({ params }: { params: Promise<{ slug: string; editorId: string }> }) {
    const resolvedParams = use(params);
    const { slug, editorId } = resolvedParams;
    const router = useRouter();

    // Template Data
    const [template, setTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);

    // User Data
    const [userId, setUserId] = useState<string | null>(null);

    // Dynamic State
    const [images, setImages] = useState<{ [key: string]: string | null }>({});
    const [texts, setTexts] = useState<{ [key: string]: string }>({});

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [activeImageKey, setActiveImageKey] = useState<string | null>(null);
    const [activeAspectRatio, setActiveAspectRatio] = useState<number>(1);
    const [targetDimensions, setTargetDimensions] = useState<{ width: number; height: number }>({ width: 1920, height: 1920 });
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const cropperRef = useRef<ReactCropperElement>(null);

    // Rendering State
    const [isRendering, setIsRendering] = useState(false);

    useEffect(() => {
        fetchTemplate();
        fetchUser();
    }, [editorId]);

    const fetchUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUserId(user.id);
        }
    };

    const fetchTemplate = async () => {
        try {
            const res = await fetch(`/api/templates/${slug}`);
            const data = await res.json();

            if (!res.ok || !data.template) {
                router.push("/templates");
                return;
            }

            const t: Template = data.template;
            setTemplate(t);

            // Initialize state from template placeholders
            const imgState: { [key: string]: string | null } = {};
            t.image_placeholders?.forEach(p => {
                imgState[p.key] = null;
            });
            setImages(imgState);

            const txtState: { [key: string]: string } = {};
            t.text_placeholders?.forEach(p => {
                txtState[p.key] = p.defaultValue || "";
            });
            setTexts(txtState);
        } catch (error) {
            console.error("Error fetching template:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>, placeholder: ImagePlaceholder) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadingFile(file);
            const reader = new FileReader();
            reader.onload = () => {
                setImageToCrop(reader.result as string);
                setActiveImageKey(placeholder.key);

                // Parse aspect ratio to get both ratio and dimensions
                const parsed = parseAspectRatio(placeholder.aspectRatio);
                setActiveAspectRatio(parsed.ratio);
                setTargetDimensions({ width: parsed.width, height: parsed.height });

                setShowCropper(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const getCropData = async () => {
        if (!cropperRef.current || !activeImageKey) return;

        // Get cropped canvas with EXACT target dimensions
        const canvas = cropperRef.current.cropper.getCroppedCanvas({
            width: targetDimensions.width,
            height: targetDimensions.height,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: "high",
        });

        console.log(`Cropped image dimensions: ${canvas.width}x${canvas.height}`);

        const croppedDataUrl = canvas.toDataURL("image/png");

        // Set local preview immediately
        setImages(prev => ({
            ...prev,
            [activeImageKey]: croppedDataUrl
        }));
        setShowCropper(false);

        // Upload to R2 if user is logged in
        if (userId && uploadingFile && template) {
            try {
                canvas.toBlob(async (blob) => {
                    if (!blob) return;

                    const formData = new FormData();
                    formData.append("userId", userId);
                    formData.append("templateId", template.id);
                    formData.append("placeholderKey", activeImageKey);
                    formData.append("file", blob, uploadingFile.name);

                    const res = await fetch("/api/user/upload", {
                        method: "POST",
                        body: formData,
                    });

                    const data = await res.json();
                    if (data.url) {
                        // Update with R2 URL
                        setImages(prev => ({
                            ...prev,
                            [activeImageKey!]: data.url
                        }));
                    }
                }, "image/png");
            } catch (error) {
                console.error("Upload error:", error);
            }
        }

        setUploadingFile(null);
    };

    const handleRender = async () => {
        if (!template || !userId) {
            alert("Please log in to render videos");
            return;
        }

        // Check if all required images are uploaded
        const missingImages = template.image_placeholders?.filter(
            (p) => !images[p.key] || !images[p.key]?.startsWith("http")
        );
        if (missingImages?.length > 0) {
            alert(`Please upload: ${missingImages.map((p) => p.label).join(", ")}`);
            return;
        }

        setIsRendering(true);

        try {
            // Build parameters object with placeholder keys
            const parameters: Record<string, string> = {};

            // Add image URLs (must be R2 URLs, not base64)
            for (const [key, url] of Object.entries(images)) {
                if (url && url.startsWith("http")) {
                    parameters[key] = url;
                }
            }

            // Add text values
            for (const [key, value] of Object.entries(texts)) {
                if (value) {
                    parameters[key] = value;
                }
            }

            // Call render API
            const res = await fetch("/api/render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateId: template.id,
                    userId,
                    parameters,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Render failed");
            }

            // Navigate to render status page
            router.push(`/render/${data.renderJobId}`);
        } catch (error) {
            console.error("Render error:", error);
            alert(`Render failed: ${error}`);
            setIsRendering(false);
        }
    };

    if (loading) {
        return (
            <main className="h-screen bg-[#070708] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
            </main>
        );
    }

    if (!template) {
        return null;
    }

    const firstImageKey = template.image_placeholders?.[0]?.key;
    const firstTextKey = template.text_placeholders?.[0]?.key;
    const secondTextKey = template.text_placeholders?.[1]?.key;

    return (
        <main className="min-h-screen lg:h-screen bg-[#070708] flex flex-col overflow-x-hidden lg:overflow-hidden text-gray-300 relative">
            {/* Cropper Modal */}
            <AnimatePresence>
                {showCropper && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm"
                    >
                        <div className="bg-[#121214] border border-white/10 rounded-3xl overflow-hidden max-w-4xl w-full flex flex-col shadow-2xl">
                            <div className="p-6 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="bg-indigo-600/20 p-2 rounded-lg">
                                        <CropIcon className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold">Crop Image</h3>
                                        <p className="text-xs text-gray-500">
                                            Required: {template.image_placeholders?.find(p => p.key === activeImageKey)?.aspectRatio || "Free"}
                                            <span className="text-indigo-400 ml-2">
                                                ({activeAspectRatio === 1 ? "Square" : activeAspectRatio > 1 ? "Landscape" : "Portrait"})
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowCropper(false)} className="text-gray-500 hover:text-white transition-colors">
                                    <X />
                                </button>
                            </div>

                            <div className="p-8 max-h-[60vh] flex items-center justify-center">
                                <Cropper
                                    src={imageToCrop || ""}
                                    style={{ height: 400, width: "100%" }}
                                    aspectRatio={activeAspectRatio}
                                    guides={true}
                                    ref={cropperRef}
                                    viewMode={1}
                                    background={false}
                                    responsive={true}
                                    autoCropArea={1}
                                    checkOrientation={false}
                                />
                            </div>

                            <div className="p-6 bg-black/40 border-t border-white/10 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowCropper(false)}
                                    className="px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={getCropData}
                                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Save Selection
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-black/40 flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-6">
                    <Link href={`/templates/${slug}`} className="hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="h-4 w-[1px] bg-white/10" />
                    <div className="flex items-center gap-3">
                        <span className="text-white font-semibold">{template.title}</span>
                        <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400">Draft</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-lg text-sm transition-colors">
                        <Save className="w-4 h-4" /> Save
                    </button>
                    <button
                        onClick={handleRender}
                        disabled={isRendering}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50"
                    >
                        {isRendering ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Rendering...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Render Video</>
                        )}
                    </button>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden">
                {/* Sidebar - Horizontal on mobile, Vertical on desktop */}
                <aside className="w-full lg:w-16 border-b lg:border-r lg:border-b-0 border-white/5 bg-black/20 flex lg:flex-col items-center justify-center lg:justify-start py-3 lg:py-6 gap-6 shrink-0 z-20">
                    <button className="p-3 text-indigo-400 bg-indigo-500/10 rounded-xl"><Layers className="w-5 h-5" /></button>
                    <button className="p-3 hover:bg-white/5 rounded-xl"><Type className="w-5 h-5" /></button>
                    <button className="p-3 hover:bg-white/5 rounded-xl"><LucideImage className="w-5 h-5" /></button>
                    <div className="hidden lg:block lg:flex-1" />
                    <button className="p-3 hover:bg-white/5 rounded-xl"><Settings className="w-5 h-5" /></button>
                </aside>

                <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                    {/* Canvas Preview */}
                    <div className="w-full lg:flex-1 bg-black flex items-center justify-center p-6 lg:p-12 relative min-h-[300px] lg:min-h-0">
                        <div className="aspect-video w-full max-w-4xl bg-[#0F0F11] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col items-center justify-center group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />

                            {template?.preview_url ? (
                                <video
                                    src={template.preview_url}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-white/20">
                                    <div className="p-4 lg:p-6 border-2 border-dashed border-white/10 rounded-full">
                                        <LucideImage className="w-8 h-8 lg:w-12 lg:h-12" />
                                    </div>
                                    <span className="text-[10px] uppercase tracking-widest">No preview available</span>
                                </div>
                            )}

                            <div className="absolute top-4 left-4 text-[10px] font-mono text-gray-700">TEMPLATE PREVIEW</div>
                        </div>

                    </div>

                    {/* Dynamic Asset Panel */}
                    <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-white/5 bg-black/20 p-6 flex flex-col gap-8 shrink-0 overflow-visible lg:overflow-y-auto">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Dynamic Assets</h3>
                                <span className="text-[10px] text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                                    {(template.image_placeholders?.length || 0) + (template.text_placeholders?.length || 0)} Inputs
                                </span>
                            </div>

                            <div className="space-y-8">
                                {/* Image Placeholders */}
                                {template.image_placeholders?.map((placeholder) => (
                                    <div key={placeholder.key} className="space-y-4">
                                        <label className="text-[11px] font-bold text-gray-500 uppercase flex items-center justify-between">
                                            {placeholder.label}
                                            <span className="text-gray-600 font-mono text-[9px]">{placeholder.aspectRatio}</span>
                                        </label>
                                        <div className="relative group/upload">
                                            <input
                                                type="file"
                                                className="hidden"
                                                id={`upload-${placeholder.key}`}
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, placeholder)}
                                            />
                                            <label
                                                htmlFor={`upload-${placeholder.key}`}
                                                className="aspect-square w-full bg-white/[0.02] border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/[0.04] hover:border-indigo-500/50 transition-all p-4 text-center group"
                                            >
                                                {images[placeholder.key] ? (
                                                    <div className="relative w-full h-full flex items-center justify-center">
                                                        <img src={images[placeholder.key]!} alt={placeholder.label} className="max-w-full max-h-full object-contain rounded-lg" />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                            <span className="text-[10px] font-bold text-white flex items-center gap-1"><Upload className="w-3 h-3" /> Change</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <Upload className="w-5 h-5 text-indigo-400" />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-white">Upload {placeholder.label}</p>
                                                            <p className="text-[10px] text-gray-500 mt-1">{placeholder.aspectRatio}</p>
                                                        </div>
                                                    </>
                                                )}
                                            </label>
                                            {images[placeholder.key] && (
                                                <button
                                                    onClick={() => setImages(prev => ({ ...prev, [placeholder.key]: null }))}
                                                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover/upload:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Text Placeholders */}
                                {template.text_placeholders?.length > 0 && (
                                    <div className="space-y-6">
                                        {template.text_placeholders.map((placeholder) => (
                                            <div key={placeholder.key} className="space-y-3">
                                                <label className="text-[11px] font-bold text-gray-500 uppercase">{placeholder.label}</label>
                                                <div className="relative group">
                                                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" />
                                                    <input
                                                        className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 focus:outline-none transition-all placeholder:text-gray-700"
                                                        value={texts[placeholder.key] || ""}
                                                        onChange={(e) => setTexts(prev => ({ ...prev, [placeholder.key]: e.target.value }))}
                                                        placeholder={`Enter ${placeholder.label}...`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-auto pt-6 border-t border-white/5">
                            <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Tip</span>
                                </div>
                                <p className="text-[10px] text-gray-500 leading-relaxed">
                                    Your uploads are automatically saved and stored securely in the cloud.
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
}
