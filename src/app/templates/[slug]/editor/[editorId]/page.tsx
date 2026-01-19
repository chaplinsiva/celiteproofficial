"use client";

import React, { use, useState, useRef, ChangeEvent, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Save, Download, Settings,
    Layers, Type, Image as LucideImage,
    Loader2, Sparkles, Upload, X, Crop as CropIcon, Check,
    ZoomIn, ZoomOut, RotateCcw, Move, RefreshCw, Eye
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cropper, ReactCropperElement } from "react-cropper";
import "cropperjs/dist/cropper.css";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ImagePlaceholder {
    key: string;
    label: string;
    aspectRatio: string;
    previewTimestamp?: number;
    referenceImageUrl?: string;
}

interface TextPlaceholder {
    key: string;
    label: string;
    defaultValue: string;
    previewTimestamp?: number;
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

    // Project State
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // Cropper State
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [activeImageKey, setActiveImageKey] = useState<string | null>(null);
    const [activeAspectRatio, setActiveAspectRatio] = useState<number>(1);
    const [targetDimensions, setTargetDimensions] = useState<{ width: number; height: number }>({ width: 1920, height: 1920 });
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const [cropBoxData, setCropBoxData] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
    const cropperRef = useRef<ReactCropperElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Rendering State
    const [isRendering, setIsRendering] = useState(false);
    const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
    const [activePlaceholder, setActivePlaceholder] = useState<string | null>(null);

    const seekTo = (timestamp?: number) => {
        if (timestamp !== undefined && videoRef.current) {
            videoRef.current.currentTime = timestamp;
            videoRef.current.pause();
        }
    };

    useEffect(() => {
        fetchTemplate();
    }, [editorId]);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
            } else {
                toast.warning("You are in guest mode. Log in to save your creative progress!", {
                    duration: 5000,
                    action: {
                        label: "Log In",
                        onClick: () => router.push("/login")
                    }
                });
            }
        };
        checkUser();
    }, []);


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

            // Check if editorId is a UUID (it might be a projectId)
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editorId);

            if (isUuid) {
                // Try to fetch project data
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const projectRes = await fetch(`/api/projects/${editorId}?userId=${user.id}`);
                    const projectData = await projectRes.json();
                    if (projectRes.ok && projectData.project) {
                        setProjectId(projectData.project.id);
                        setProjectName(projectData.project.name);

                        // Load saved configuration
                        const config = projectData.project.configuration;
                        if (config.images) setImages(config.images);
                        if (config.texts) setTexts(config.texts);
                        return; // Skip default initialization
                    }
                }
            }

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

    const handleSave = async (silent = false) => {
        if (!template || !userId) {
            if (!silent) toast.error("Please log in to save projects");
            return null;
        }

        if (!silent) setIsSaving(true);

        try {
            let nameToSave = projectName;
            if (!nameToSave) {
                // Fetch project count to name it "Celite Project N"
                const { data: countData } = await supabase
                    .from("projects")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", userId);

                const count = (countData?.length || 0) + 1;
                nameToSave = `Celite Project ${count}`;
                setProjectName(nameToSave);
            }

            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: projectId,
                    userId,
                    templateId: template.id,
                    name: nameToSave,
                    configuration: {
                        images,
                        texts
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setProjectId(data.project.id);
                if (!silent) {
                    // Update URL if it was "new" or a placeholder
                    if (editorId !== data.project.id) {
                        router.replace(`/templates/${slug}/editor/${data.project.id}`);
                    }
                }
                return data.project.id;
            } else {
                throw new Error(data.error || "Failed to save project");
            }
        } catch (error) {
            console.error("Save error:", error);
            if (!silent) toast.error(`Failed to save project: ${error}`);
            return null;
        } finally {
            if (!silent) setIsSaving(false);
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
            e.target.value = ""; // Reset to allow re-selection
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
            const currentKey = activeImageKey;
            setUploadingKeys(prev => new Set(prev).add(currentKey));

            try {
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        setUploadingKeys(prev => {
                            const next = new Set(prev);
                            next.delete(currentKey);
                            return next;
                        });
                        return;
                    }

                    const formData = new FormData();
                    formData.append("userId", userId);
                    formData.append("templateId", template.id);
                    formData.append("placeholderKey", currentKey);
                    formData.append("file", blob, uploadingFile.name);

                    try {
                        const res = await fetch("/api/user/upload", {
                            method: "POST",
                            body: formData,
                        });

                        const data = await res.json();
                        if (data.url) {
                            // Update with R2 URL
                            setImages(prev => ({
                                ...prev,
                                [currentKey]: data.url
                            }));
                        } else {
                            throw new Error(data.error || "Upload failed");
                        }
                    } catch (err) {
                        console.error("Upload fetch error:", err);
                        toast.error(`Failed to upload ${currentKey}. Please try again.`);
                        // Reset image on failure so it doesn't get stuck in base64/uploading state
                        setImages(prev => ({ ...prev, [currentKey]: null }));
                    } finally {
                        setUploadingKeys(prev => {
                            const next = new Set(prev);
                            next.delete(currentKey);
                            return next;
                        });
                    }
                }, "image/png");
            } catch (error) {
                console.error("Upload error:", error);
                setUploadingKeys(prev => {
                    const next = new Set(prev);
                    next.delete(currentKey);
                    return next;
                });
            }
        }

        setUploadingFile(null);
    };


    const handleRender = async () => {
        if (!template || !userId) {
            toast.error("Please log in to render videos");
            return;
        }

        // 1. Check if any uploads are still in progress
        if (uploadingKeys.size > 0) {
            toast.warning("Please wait for your assets to finish uploading to the cloud.");
            return;
        }

        // 2. Check if all required images are uploaded and are remote URLs (not base64)
        const missingImages = template.image_placeholders?.filter(p => !images[p.key]);
        if (missingImages?.length > 0) {
            toast.warning(`Please upload: ${missingImages.map(p => p.label).join(", ")}`);
            return;
        }

        const stillBase64 = template.image_placeholders?.filter(p => images[p.key]?.startsWith("data:"));
        if (stillBase64?.length > 0) {
            toast.warning("Some assets are still synchronizing. Please wait a moment.");
            return;
        }

        setIsRendering(true);

        try {
            // Auto-save before render
            const savedProjectId = await handleSave(true);
            if (!savedProjectId) {
                throw new Error("Failed to auto-save project before rendering");
            }

            // Step 1: Create payment order
            const orderRes = await fetch("/api/payment/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    templateId: template.id,
                    userId,
                    projectId: savedProjectId,
                }),
            });

            const orderData = await orderRes.json();

            if (!orderRes.ok) {
                throw new Error(orderData.error || "Failed to create payment order");
            }

            // Step 2: Open Razorpay checkout
            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "CelitePro",
                description: `Render: ${template.title}`,
                order_id: orderData.orderId,
                handler: async function (response: any) {
                    try {
                        // Step 3: Verify payment
                        const verifyRes = await fetch("/api/payment/verify-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                orderId: response.razorpay_order_id,
                                paymentId: response.razorpay_payment_id,
                                signature: response.razorpay_signature,
                            }),
                        });

                        const verifyData = await verifyRes.json();

                        if (!verifyRes.ok) {
                            throw new Error(verifyData.error || "Payment verification failed");
                        }

                        // Step 4: Start render after successful payment
                        const parameters: Record<string, string> = {};

                        // Add image URLs
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

                        // Step 4: Navigate to render status page (render already started server-side)
                        if (verifyData.renderJobId) {
                            router.push(`/render/${verifyData.renderJobId}`);
                        } else {
                            // Fallback to dashboard if something went wrong but payment was success
                            router.push('/dashboard');
                            toast.success("Payment successful! Your render will start shortly.");
                        }
                    } catch (error) {
                        console.error("Post-payment error:", error);
                        toast.error(`Error: ${error}`);
                        setIsRendering(false);
                    }
                },
                modal: {
                    ondismiss: function () {
                        setIsRendering(false);
                    },
                },
                theme: {
                    color: "#4F46E5",
                },
            };

            // @ts-ignore - Razorpay is loaded via script
            const razorpay = new window.Razorpay(options);
            razorpay.open();

        } catch (error) {
            console.error("Payment error:", error);
            toast.error(`Payment failed: ${error}`);
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
                        className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-sm"
                    >
                        <div className="bg-[#121214] border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden max-w-4xl w-full flex flex-col shadow-2xl max-h-[95vh] sm:max-h-[90vh]">
                            <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
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

                            <div className="px-4 sm:px-8 pb-4 flex items-center flex-wrap justify-center gap-2">
                                <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex items-center gap-1">
                                    <button
                                        onClick={() => cropperRef.current?.cropper.zoom(0.1)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => cropperRef.current?.cropper.zoom(-0.1)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                                    <button
                                        onClick={() => cropperRef.current?.cropper.rotate(-90)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                        title="Rotate Left"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => cropperRef.current?.cropper.rotate(90)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                        title="Rotate Right"
                                    >
                                        <RotateCcw className="w-4 h-4 scale-x-[-1]" />
                                    </button>
                                    <div className="w-[1px] h-4 bg-white/10 mx-1" />
                                    <button
                                        onClick={() => {
                                            cropperRef.current?.cropper.reset();
                                            cropperRef.current?.cropper.setDragMode('move');
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                        title="Reset"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex items-center gap-1">
                                    <button
                                        onClick={() => cropperRef.current?.cropper.setDragMode('move')}
                                        className="p-2 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg text-gray-400 transition-all focus:text-indigo-400 focus:bg-indigo-500/20"
                                        title="Move Mode"
                                    >
                                        <Move className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => cropperRef.current?.cropper.setDragMode('crop')}
                                        className="p-2 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-lg text-gray-400 transition-all focus:text-indigo-400 focus:bg-indigo-500/20"
                                        title="Crop Mode"
                                    >
                                        <CropIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-2 sm:p-8 pt-0 flex-1 flex items-center justify-center relative bg-black/40 overflow-hidden min-h-[300px]">
                                <div className="relative w-full h-full min-h-[250px] max-h-[60vh]">
                                    <Cropper
                                        src={imageToCrop || ""}
                                        style={{ height: "100%", width: "100%" }}
                                        aspectRatio={activeAspectRatio}
                                        guides={true}
                                        ref={cropperRef}
                                        viewMode={0}
                                        dragMode="move"
                                        background={false}
                                        responsive={true}
                                        autoCropArea={1}
                                        checkOrientation={false}
                                        toggleDragModeOnDblclick={true}
                                        center={true}
                                        movable={true}
                                        zoomable={true}
                                        wheelZoomRatio={0.1}
                                        ready={() => {
                                            const cropper = cropperRef.current?.cropper;
                                            if (cropper) {
                                                setCropBoxData(cropper.getCropBoxData());
                                            }
                                        }}
                                        crop={() => {
                                            const cropper = cropperRef.current?.cropper;
                                            if (cropper) {
                                                setCropBoxData(cropper.getCropBoxData());
                                            }
                                        }}
                                    />
                                    {/* Reference image overlay on the crop box - synchronized with cropper data */}
                                    {cropBoxData && activeImageKey && template?.image_placeholders?.find(p => p.key === activeImageKey)?.referenceImageUrl && (
                                        <div
                                            className="absolute pointer-events-none z-10 overflow-hidden"
                                            style={{
                                                left: cropBoxData.left,
                                                top: cropBoxData.top,
                                                width: cropBoxData.width,
                                                height: cropBoxData.height,
                                            }}
                                        >
                                            <img
                                                src={template?.image_placeholders?.find(p => p.key === activeImageKey)?.referenceImageUrl}
                                                alt="Reference Guide"
                                                className="w-full h-full object-cover opacity-40"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 bg-black/40 border-t border-white/10 flex justify-end gap-3">
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
            <header className="h-16 border-b border-white/5 bg-black/40 flex items-center justify-between px-4 md:px-6 shrink-0 z-10">
                <div className="flex items-center gap-3 md:gap-6 min-w-0">
                    <Link href={`/templates/${slug}`} className="p-2 hover:bg-white/5 rounded-lg transition-all shrink-0">
                        <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white" />
                    </Link>
                    <div className="hidden xs:block h-4 w-[1px] bg-white/10 shrink-0" />
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            onBlur={() => handleSave(true)}
                            placeholder="Celite Project 1"
                            className="bg-transparent border-none text-white font-semibold truncate text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-white/10 rounded px-1 min-w-[120px]"
                        />
                        <span className="hidden lg:inline-block text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400 shrink-0">
                            {projectId ? "Saved" : "Draft"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={() => handleSave()}
                        disabled={isSaving}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-lg text-sm transition-colors shrink-0 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                        onClick={handleRender}
                        disabled={isRendering || uploadingKeys.size > 0}
                        className="flex items-center gap-2 px-4 md:px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs md:text-sm font-bold shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        {isRendering ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                        ) : (
                            <>
                                {uploadingKeys.size > 0 ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                ) : (
                                    <><Download className="w-4 h-4" /> Pay ₹199 & Render</>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden relative">
                {/* Sidebar - Horizontal on mobile, Vertical on desktop */}
                <aside className="w-full lg:w-16 border-b lg:border-r lg:border-b-0 border-white/5 bg-black/20 flex lg:flex-col items-center justify-center lg:justify-start py-3 lg:py-6 gap-6 shrink-0 z-20">
                    <button className="p-3 text-indigo-400 bg-indigo-500/10 rounded-xl"><Layers className="w-5 h-5" /></button>
                    <button className="p-3 hover:bg-white/5 rounded-xl"><Type className="w-5 h-5" /></button>
                    <button className="p-3 hover:bg-white/5 rounded-xl"><LucideImage className="w-5 h-5" /></button>
                    <div className="hidden lg:block lg:flex-1" />
                    <button className="p-3 hover:bg-white/5 rounded-xl"><Settings className="w-5 h-5" /></button>
                </aside>

                <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
                    {/* Canvas Preview */}
                    <div className="w-full lg:flex-1 bg-black flex items-center justify-center p-4 lg:p-12 relative min-h-[300px] lg:min-h-0 sticky top-0 z-40 bg-[#070708] border-b border-white/5 shadow-2xl lg:shadow-none transition-all duration-300">
                        <div className="aspect-video w-full max-w-4xl bg-[#0F0F11] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col items-center justify-center group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />

                            {template?.preview_url ? (
                                <video
                                    ref={videoRef}
                                    src={template.preview_url}
                                    className="w-full h-full object-cover"
                                    loop
                                    muted
                                    playsInline
                                    controls
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
                                            <span>{placeholder.label}</span>
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
                                            <div
                                                onClick={() => {
                                                    if (activePlaceholder !== placeholder.key) {
                                                        setActivePlaceholder(placeholder.key);
                                                        seekTo(placeholder.previewTimestamp);
                                                    }
                                                }}
                                                style={{ aspectRatio: parseAspectRatio(placeholder.aspectRatio).ratio }}
                                                className={`w-full rounded-2xl flex flex-col items-center justify-center gap-4 transition-all p-4 text-center group relative overflow-hidden ${activePlaceholder === placeholder.key
                                                    ? 'bg-indigo-500/5 border-2 border-indigo-500/50 shadow-[0_0_20px_rgba(79,70,229,0.2)]'
                                                    : 'bg-white/[0.02] border border-dashed border-white/10 cursor-pointer hover:bg-white/[0.04] hover:border-white/20'
                                                    }`}
                                            >

                                                {images[placeholder.key] ? (
                                                    <div className="relative w-full h-full flex items-center justify-center">
                                                        {/* Reference image behind user image with low opacity */}
                                                        {placeholder.referenceImageUrl && (
                                                            <img
                                                                src={placeholder.referenceImageUrl}
                                                                alt="Reference"
                                                                className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
                                                            />
                                                        )}
                                                        <img src={images[placeholder.key]!} alt={placeholder.label} className="max-w-full max-h-full object-contain rounded-lg z-10" />
                                                        {activePlaceholder === placeholder.key && (
                                                            <label
                                                                htmlFor={`upload-${placeholder.key}`}
                                                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer z-20"
                                                            >
                                                                <span className="text-[10px] font-bold text-white flex items-center gap-1"><Upload className="w-3 h-3" /> Change</span>
                                                            </label>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <>
                                                        {/* Reference image as background guide */}
                                                        {placeholder.referenceImageUrl && (
                                                            <img
                                                                src={placeholder.referenceImageUrl}
                                                                alt="Reference"
                                                                className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none rounded-2xl"
                                                            />
                                                        )}
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all z-10 ${activePlaceholder === placeholder.key ? 'bg-indigo-500 text-white scale-110 shadow-lg' : 'bg-indigo-500/10 text-indigo-400 group-hover:scale-110'
                                                            }`}>
                                                            <Upload className="w-5 h-5" />
                                                        </div>
                                                        <div className="z-10">
                                                            <p className={`text-sm font-semibold ${activePlaceholder === placeholder.key ? 'text-white' : 'text-gray-400'}`}>
                                                                {activePlaceholder === placeholder.key ? `Ready to Upload` : `Select to View`}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 mt-1">{placeholder.label}</p>
                                                        </div>
                                                        {activePlaceholder === placeholder.key && (
                                                            <label
                                                                htmlFor={`upload-${placeholder.key}`}
                                                                className="absolute inset-0 cursor-pointer z-20"
                                                            />
                                                        )}
                                                    </>
                                                )}

                                                {/* Uploading Overlay */}
                                                <AnimatePresence>
                                                    {uploadingKeys.has(placeholder.key) && (
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="absolute inset-0 bg-black/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2"
                                                        >
                                                            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                                                            <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest animate-pulse">Uploading...</span>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
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
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[11px] font-bold text-gray-500 uppercase">{placeholder.label}</label>
                                                </div>
                                                <div className="relative group">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        <Type className="w-4 h-4 text-gray-600 group-focus-within:text-indigo-400 transition-colors" />
                                                    </div>
                                                    <input
                                                        className={`w-full bg-white/[0.03] border rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none transition-all placeholder:text-gray-700 ${activePlaceholder === placeholder.key
                                                            ? 'border-indigo-500/50 ring-1 ring-indigo-500/50 bg-indigo-500/5'
                                                            : 'border-white/10 hover:border-white/20'
                                                            }`}
                                                        value={texts[placeholder.key] || ""}
                                                        onChange={(e) => setTexts(prev => ({ ...prev, [placeholder.key]: e.target.value }))}
                                                        onFocus={() => {
                                                            setActivePlaceholder(placeholder.key);
                                                            seekTo(placeholder.previewTimestamp);
                                                        }}
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
