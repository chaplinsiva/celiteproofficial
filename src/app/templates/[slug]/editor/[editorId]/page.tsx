"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { use, useState, useRef, ChangeEvent, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Save, Download,
    Type, Image as LucideImage,
    Loader2, Sparkles, Upload, X, Crop as CropIcon, Check,
    ZoomIn, ZoomOut, RotateCcw, Move, RefreshCw, Eye, Crown, AlertTriangle,
    XCircle, Edit3, Maximize2, Minimize2
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
    aspect_ratio: string;
    preview_url: string;
    thumbnail_url: string;
    duration?: string;
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
    const [showRenderConfirm, setShowRenderConfirm] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [activeImageKey, setActiveImageKey] = useState<string | null>(null);
    const [activeAspectRatio, setActiveAspectRatio] = useState<number>(1);
    const [targetDimensions, setTargetDimensions] = useState<{ width: number; height: number }>({ width: 1920, height: 1920 });
    const [uploadingFile, setUploadingFile] = useState<File | null>(null);
    const [cropBoxData, setCropBoxData] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
    const cropperRef = useRef<ReactCropperElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);

    // Recent Uploads Modal State
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [recentUploads, setRecentUploads] = useState<any[]>([]);
    const [loadingRecentUploads, setLoadingRecentUploads] = useState(false);


    // Rendering State
    const [isRendering, setIsRendering] = useState(false);
    const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
    const [removingBgKeys, setRemovingBgKeys] = useState<Set<string>>(new Set());
    const [shouldRemoveBg, setShouldRemoveBg] = useState(false);
    const [bgRemovalMode, setBgRemovalMode] = useState<"people" | "logo">("people");
    const [activePlaceholder, setActivePlaceholder] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<any>(null);
    const [freeBgRemovalsRemaining, setFreeBgRemovalsRemaining] = useState<number | null>(null);
    const [showBgMenu, setShowBgMenu] = useState<string | null>(null);
    const [showPurchasePopup, setShowPurchasePopup] = useState(false);

    // In-Editor Free Preview State
    const [previewJobId, setPreviewJobId] = useState<string | null>(null);
    const [previewStatus, setPreviewStatus] = useState<"idle" | "polling" | "completed" | "failed">("idle");
    const [previewPlainlyState, setPreviewPlainlyState] = useState<string | null>(null);
    const [previewDisplayProgress, setPreviewDisplayProgress] = useState(0);
    const [previewOutputUrl, setPreviewOutputUrl] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const previewPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const previewPollStartRef = useRef<number>(0);
    const MAX_PREVIEW_POLL_MS = 10 * 60 * 1000; // 10 minutes

    // Timeline Editor States
    const [currentTime, setCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(15);
    const [timelineZoom, setTimelineZoom] = useState(2);
    const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
    const timelineScrollRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

    const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input') || target.closest('a') || target.closest('[key^="block-"]')) {
            return;
        }

        const container = timelineScrollRef.current;
        if (!container) return;

        dragStartRef.current = { x: e.clientX, y: e.clientY };
        const startX = e.pageX - container.offsetLeft;
        const scrollLeftStart = container.scrollLeft;
        let hasMoved = false;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - dragStartRef.current.x);
            const deltaY = Math.abs(moveEvent.clientY - dragStartRef.current.y);
            if (deltaX > 4 || deltaY > 4) {
                hasMoved = true;
            }
            if (hasMoved) {
                const x = moveEvent.pageX - container.offsetLeft;
                const walk = (x - startX) * 1.5;
                container.scrollLeft = scrollLeftStart - walk;
            }
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            if (hasMoved) {
                upEvent.stopPropagation();
                const preventClick = (clickEvent: MouseEvent) => {
                    clickEvent.stopPropagation();
                    clickEvent.preventDefault();
                    window.removeEventListener('click', preventClick, true);
                };
                window.addEventListener('click', preventClick, true);
                setTimeout(() => window.removeEventListener('click', preventClick, true), 50);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Auto-scroll the timeline to center the playhead if it goes out of bounds
    useEffect(() => {
        if (!timelineScrollRef.current || timelineZoom === 1) return;
        const container = timelineScrollRef.current;
        const playheadPercent = currentTime / videoDuration;
        const playheadX = playheadPercent * container.scrollWidth;
        const scrollLeft = container.scrollLeft;
        const visibleWidth = container.clientWidth;

        if (playheadX < scrollLeft || playheadX > scrollLeft + visibleWidth) {
            container.scrollTo({
                left: playheadX - visibleWidth / 2,
                behavior: "smooth"
            });
        }
    }, [currentTime, videoDuration, timelineZoom]);


    const parseDurationToSeconds = (durStr?: string): number => {
        if (!durStr) return 15;
        if (durStr.includes(":")) {
            const parts = durStr.split(":");
            if (parts.length === 2) {
                return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
            } else if (parts.length === 3) {
                return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
            }
        }
        const val = parseFloat(durStr);
        return isNaN(val) ? 15 : val;
    };

    useEffect(() => {
        if (template?.duration) {
            setVideoDuration(parseDurationToSeconds(template.duration));
        }
    }, [template]);

    const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = clickX / rect.width;
        const newTime = percent * videoDuration;
        
        if (previewStatus === "completed" && previewVideoRef.current) {
            previewVideoRef.current.currentTime = newTime;
        } else if (videoRef.current) {
            videoRef.current.currentTime = newTime;
        }
        setCurrentTime(newTime);
    };

    const handlePlaceholderDrag = (
        e: React.MouseEvent | React.TouchEvent, 
        type: "image" | "text", 
        index: number
    ) => {
        e.stopPropagation();
        const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const targetTrack = e.currentTarget.parentElement;
        if (!targetTrack) return;
        
        const rect = targetTrack.getBoundingClientRect();
        const trackWidth = rect.width;
        
        const placeholder = type === "image" 
            ? template?.image_placeholders?.[index]
            : template?.text_placeholders?.[index];
            
        if (!placeholder) return;
        const originalTimestamp = placeholder.previewTimestamp ?? 0;
        
        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const deltaX = currentX - startX;
            const deltaPercent = deltaX / trackWidth;
            const deltaSecs = deltaPercent * videoDuration;
            let newSecs = Math.max(0, Math.min(videoDuration, originalTimestamp + deltaSecs));
            // Round to 1 decimal place
            newSecs = Math.round(newSecs * 10) / 10;
            
            // Update state
            if (type === "image") {
                setTemplate(prev => {
                    if (!prev) return null;
                    const updated = [...prev.image_placeholders];
                    updated[index] = { ...updated[index], previewTimestamp: newSecs };
                    return { ...prev, image_placeholders: updated };
                });
            } else {
                setTemplate(prev => {
                    if (!prev) return null;
                    const updated = [...prev.text_placeholders];
                    updated[index] = { ...updated[index], previewTimestamp: newSecs };
                    return { ...prev, text_placeholders: updated };
                });
            }

            // Seek video dynamically to the dragged position so they see the result immediately
            if (previewStatus === "completed" && previewVideoRef.current) {
                previewVideoRef.current.currentTime = newSecs;
            } else if (videoRef.current) {
                videoRef.current.currentTime = newSecs;
            }
            setCurrentTime(newSecs);
        };
        
        const handleUp = () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
            window.removeEventListener("touchmove", handleMove);
            window.removeEventListener("touchend", handleUp);
        };
        
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
        window.addEventListener("touchmove", handleMove);
        window.addEventListener("touchend", handleUp);
    };

    const focusAsidePlaceholder = (key: string) => {
        setActivePlaceholder(key);
        setTimeout(() => {
            const el = document.getElementById(`input-${key}`) || document.getElementById(`container-${key}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                if (el.tagName === "INPUT") {
                    (el as HTMLInputElement).focus();
                }
            }
        }, 100);
    };

    const seekTo = (timestamp?: number) => {
        if (timestamp !== undefined) {
            if (previewStatus === "completed" && previewVideoRef.current) {
                previewVideoRef.current.currentTime = timestamp;
                previewVideoRef.current.pause();
            } else if (videoRef.current) {
                videoRef.current.currentTime = timestamp;
                videoRef.current.pause();
            }
            setCurrentTime(timestamp);
        }
    };

    // ── In-Editor Preview: reset helper ──────────────────────────────────
    const resetPreview = useCallback(() => {
        if (previewPollRef.current) {
            clearInterval(previewPollRef.current);
            previewPollRef.current = null;
        }
        setPreviewJobId(null);
        setPreviewStatus("idle");
        setPreviewOutputUrl(null);
        setPreviewError(null);
        setPreviewPlainlyState(null);
        setPreviewDisplayProgress(0);
        setIsRendering(false);
    }, []);

    // ── In-Editor Preview: polling effect ────────────────────────────────
    useEffect(() => {
        if (previewStatus !== "polling" || !previewJobId) return;

        const pollStatus = async () => {
            // Timeout guard
            if (Date.now() - previewPollStartRef.current >= MAX_PREVIEW_POLL_MS) {
                setPreviewStatus("failed");
                setPreviewError("Preview is taking too long. Please try again.");
                setIsRendering(false);
                if (previewPollRef.current) clearInterval(previewPollRef.current);
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const res = await fetch(`/api/render/status?jobId=${previewJobId}`, {
                    headers: {
                        ...(token ? { "Authorization": `Bearer ${token}` } : {})
                    }
                });
                const data = await res.json();

                if (data.status === "completed" && data.outputUrl) {
                    setPreviewOutputUrl(data.outputUrl);
                    setPreviewStatus("completed");
                    setIsRendering(false);
                    if (previewPollRef.current) clearInterval(previewPollRef.current);
                } else if (data.status === "failed") {
                    setPreviewStatus("failed");
                    setPreviewError(data.error || "Preview render failed.");
                    setIsRendering(false);
                    if (previewPollRef.current) clearInterval(previewPollRef.current);
                } else {
                    setPreviewPlainlyState(data.plainlyState || null);
                }
            } catch (err) {
                console.error("Preview poll error:", err);
            }
        };

        // Initial check
        pollStatus();
        // Poll every 2 seconds
        previewPollRef.current = setInterval(pollStatus, 2000);

        return () => {
            if (previewPollRef.current) {
                clearInterval(previewPollRef.current);
                previewPollRef.current = null;
            }
        };
    }, [previewStatus, previewJobId]);

    // Update smooth preview display progress based on actual states
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (previewStatus === "polling") {
            interval = setInterval(() => {
                setPreviewDisplayProgress((prev) => {
                    let targetMax = 15;
                    let step = 0.2; // default increment per 100ms tick

                    const plainly = previewPlainlyState;
                    if (plainly === "QUEUED" || plainly === "PENDING" || plainly === "THROTTLED") {
                        targetMax = 30;
                        if (prev < 15) step = 1.0;
                        else step = 0.08;
                    } else if (plainly === "IN_PROGRESS") {
                        targetMax = 85;
                        if (prev < 30) step = 1.5;
                        else {
                            const remaining = targetMax - prev;
                            step = Math.max(0.02, remaining * 0.005);
                        }
                    } else if (plainly === "DONE") {
                        targetMax = 96;
                        if (prev < 85) step = 2.0;
                        else step = 0.08;
                    } else {
                        // Initializing
                        targetMax = 15;
                        step = 0.3;
                    }

                    if (prev < targetMax) {
                        return Math.min(targetMax, prev + step);
                    }
                    return prev;
                });
            }, 100);
        } else if (previewStatus === "completed") {
            const sweepInterval = setInterval(() => {
                setPreviewDisplayProgress((prev) => {
                    if (prev < 100) {
                        return Math.min(100, prev + 4);
                    } else {
                        clearInterval(sweepInterval);
                        return 100;
                    }
                });
            }, 30);
            return () => clearInterval(sweepInterval);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [previewStatus, previewPlainlyState]);

    useEffect(() => {
        fetchTemplate();
    }, [editorId]);

    // Save draft state to localStorage on changes
    useEffect(() => {
        if (!template) return;
        // Don't save empty/initial state
        if (Object.keys(images).length === 0) return;

        try {
            localStorage.setItem(
                `celite_draft_${editorId}`,
                JSON.stringify({
                    images,
                    texts,
                    projectName,
                })
            );
        } catch (e) {
            console.error("Failed to save draft to localStorage:", e);
        }
    }, [images, texts, projectName, editorId, template]);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                // Fetch subscription status
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const res = await fetch(`/api/subscription/status`, {
                        headers: {
                            ...(token ? { "Authorization": `Bearer ${token}` } : {})
                        }
                    });
                    const data = await res.json();
                    if (res.ok) {
                        setSubscription(data);
                        if (data.isFreeUser) {
                            setFreeBgRemovalsRemaining(data.freeBgRemovalsRemaining);
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch subscription status:", err);
                }
            } else {
                toast.warning("You are in guest mode. Log in to save your creative progress!", {
                    duration: 5000,
                    action: {
                        label: "Log In",
                        onClick: () => router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
                    }
                });
            }
        };

        checkUser();
        checkUser();
    }, []);

    const fetchRecentUploads = async () => {
        if (!userId) return;
        setLoadingRecentUploads(true);
        try {
            const { data, error } = await supabase
                .from("file_assets")
                .select("*")
                .eq("user_id", userId)
                .eq("file_type", "upload")
                .order("created_at", { ascending: false });

            if (error) throw error;

            // Filter out non-image files if any are returned
            const isImageFile = (url: string) => {
                const cleanUrl = url.split("?")[0];
                return /\.(png|jpe?g|gif|webp|svg)$/i.test(cleanUrl) || cleanUrl.includes("_nobg") || cleanUrl.includes("nobg");
            };

            const imageAssets = (data || []).filter((asset: any) => isImageFile(asset.file_url));
            setRecentUploads(imageAssets);
        } catch (error) {
            console.error("Failed to fetch recent uploads:", error);
        } finally {
            setLoadingRecentUploads(false);
        }
    };

    const handleSelectRecentUpload = (url: string) => {
        setShowUploadModal(false);
        if (!activeImageKey || !template) return;
        const placeholder = template.image_placeholders?.find(p => p.key === activeImageKey);
        if (!placeholder) return;

        const toastId = toast.loading("Preparing image for cropping...");
        
        // Proxy URL is used to bypass CORS when reading the image into HTML5 Canvas / Cropper
        fetch(`/api/user/proxy-image?url=${encodeURIComponent(url)}`)
            .then(res => {
                if (!res.ok) throw new Error("Network error downloading remote image");
                return res.blob();
            })
            .then(blob => {
                const localUrl = URL.createObjectURL(blob);
                setImageToCrop(localUrl);
                
                const parsed = parseAspectRatio(placeholder.aspectRatio);
                setActiveAspectRatio(parsed.ratio);
                setTargetDimensions({ width: parsed.width, height: parsed.height });

                // Auto-detect and pre-select background removal preferences based on placeholder label
                const label = placeholder.label?.toLowerCase() || "";
                const isLogo = label.includes("logo") || label.includes("brand") || label.includes("badge") || label.includes("icon");
                setBgRemovalMode(isLogo ? "logo" : "people");
                setShouldRemoveBg(false);

                setShowCropper(true);
                toast.dismiss(toastId);
            })
            .catch(err => {
                console.error("CORS proxy crop error:", err);
                toast.error("Failed to download image. Try re-uploading from local storage.", { id: toastId });
            });
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

            // Check if editorId is a UUID (it might be a projectId)
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editorId);

            if (isUuid) {
                // Try to fetch project data
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token;
                    const projectRes = await fetch(`/api/projects/${editorId}`, {
                        headers: {
                            ...(token ? { "Authorization": `Bearer ${token}` } : {})
                        }
                    });
                    const projectData = await projectRes.json();
                    if (projectRes.ok && projectData.project) {
                        setProjectId(projectData.project.id);
                        setProjectName(projectData.project.name);

                        // Load saved configuration
                        const config = projectData.project.configuration;
                        if (config.images) setImages(config.images);
                        if (config.texts) setTexts(config.texts);

                        const firstKey = t.image_placeholders?.[0]?.key || t.text_placeholders?.[0]?.key || null;
                        if (firstKey) setActivePlaceholder(firstKey);
                        return; // Skip default initialization
                    }
                }
            }

            // Try to load unsaved/draft progress from localStorage for this editorId
            let loadedFromDraft = false;
            try {
                const savedDraft = localStorage.getItem(`celite_draft_${editorId}`);
                if (savedDraft) {
                    const draft = JSON.parse(savedDraft);
                    if (draft.images) setImages(draft.images);
                    if (draft.texts) setTexts(draft.texts);
                    if (draft.projectName) setProjectName(draft.projectName);
                    loadedFromDraft = true;
                }
            } catch (e) {
                console.error("Failed to load local draft:", e);
            }

            if (!loadedFromDraft) {
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
            }

            const firstKey = t.image_placeholders?.[0]?.key || t.text_placeholders?.[0]?.key || null;
            if (firstKey) setActivePlaceholder(firstKey);
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

            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Clean up presigned URLs to store only clean non-expiring public URLs in database
            const cleanedImages = { ...images };
            for (const [key, url] of Object.entries(cleanedImages)) {
                if (url && typeof url === "string" && (url.includes("r2.cloudflarestorage.com") || url.includes("pub-") || url.includes("files.celitepro.in") || url.includes("cdn.celite.in"))) {
                    try {
                        const parsedUrl = new URL(url);
                        cleanedImages[key] = parsedUrl.origin + parsedUrl.pathname;
                    } catch (e) {
                        if (url.includes("?")) {
                            cleanedImages[key] = url.split("?")[0];
                        }
                    }
                }
            }

            const res = await fetch("/api/projects", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    id: projectId,
                    templateId: template.id,
                    name: nameToSave,
                    configuration: {
                        images: cleanedImages,
                        texts
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setProjectId(data.project.id);
                
                // Clear local draft for the old ID since it's now saved to database
                try {
                    localStorage.removeItem(`celite_draft_${editorId}`);
                } catch (e) {}

                // Update URL silently without triggering Next.js route navigation and page remount
                if (editorId !== data.project.id) {
                    const newPath = `/templates/${slug}/editor/${data.project.id}`;
                    window.history.replaceState(null, "", newPath);
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
            setShowUploadModal(false);
            setUploadingFile(file);
            const reader = new FileReader();
            reader.onload = () => {
                setImageToCrop(reader.result as string);
                setActiveImageKey(placeholder.key);

                // Parse aspect ratio to get both ratio and dimensions
                const parsed = parseAspectRatio(placeholder.aspectRatio);
                setActiveAspectRatio(parsed.ratio);
                setTargetDimensions({ width: parsed.width, height: parsed.height });

                // Auto-detect and pre-select background removal preferences based on placeholder label
                const label = placeholder.label?.toLowerCase() || "";
                const isLogo = label.includes("logo") || label.includes("brand") || label.includes("badge") || label.includes("icon");
                setBgRemovalMode(isLogo ? "logo" : "people");
                setShouldRemoveBg(false); // default to off — user opts in manually

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
        if (userId && template) {
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

                    try {
                        // Step 1: Get presigned URL from server (send only metadata, not the file)
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        const presignRes = await fetch("/api/user/upload", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...(token ? { "Authorization": `Bearer ${token}` } : {})
                            },
                            body: JSON.stringify({
                                templateId: template.id,
                                placeholderKey: currentKey,
                                fileName: uploadingFile?.name || `${currentKey}_cropped.png`,
                                fileType: "image/png",
                                fileSize: blob.size,
                            }),
                        });

                        const presignData = await presignRes.json();
                        if (!presignRes.ok) {
                            throw new Error(presignData.error || "Failed to get upload URL");
                        }

                        // Step 2: Upload blob directly to R2 (bypasses Vercel size limits)
                        const uploadRes = await fetch(presignData.presignedUrl, {
                            method: "PUT",
                            headers: { "Content-Type": "image/png" },
                            body: blob,
                        });

                        if (!uploadRes.ok) {
                            throw new Error("Failed to upload image to cloud storage");
                        }

                        // Update with final presigned R2 URL
                        const uploadedUrl = presignData.presignedGetUrl || presignData.url;

                        // Clear uploading state before moving to bg removal (so status transitions from "Uploading..." to "Removing BG...")
                        setUploadingKeys(prev => {
                            const next = new Set(prev);
                            next.delete(currentKey);
                            return next;
                        });

                        if (shouldRemoveBg) {
                            setRemovingBgKeys(prev => new Set(prev).add(currentKey));
                            const toastId = toast.loading(`Removing background for ${currentKey}...`);

                            try {
                                const removeRes = await fetch("/api/user/remove-bg", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                        ...(token ? { "Authorization": `Bearer ${token}` } : {})
                                    },
                                    body: JSON.stringify({ 
                                        imageUrl: uploadedUrl,
                                        mode: bgRemovalMode 
                                    }),
                                });

                                let removeData: any = null;
                                const contentType = removeRes.headers.get("content-type") || "";
                                if (contentType.includes("application/json")) {
                                    removeData = await removeRes.json();
                                } else {
                                    const text = await removeRes.text().catch(() => "");
                                    throw new Error(text || `Background removal failed (${removeRes.status})`);
                                }

                                if (!removeRes.ok) {
                                    throw new Error(removeData?.error || "Failed to remove background");
                                }

                                setImages(prev => ({
                                    ...prev,
                                    [currentKey]: removeData.presignedGetUrl || removeData.url
                                }));
                                if (removeData.freeBgRemovalsRemaining !== undefined) {
                                    setFreeBgRemovalsRemaining(removeData.freeBgRemovalsRemaining);
                                }
                                toast.success("Background removed successfully!", { id: toastId });
                            } catch (removeErr: any) {
                                console.error("BG Removal Error:", removeErr);
                                toast.error(removeErr.message || "Failed to remove background, using cropped image instead.", { id: toastId });
                                setImages(prev => ({
                                    ...prev,
                                    [currentKey]: uploadedUrl
                                }));
                            } finally {
                                setRemovingBgKeys(prev => {
                                    const next = new Set(prev);
                                    next.delete(currentKey);
                                    return next;
                                });
                            }
                        } else {
                            setImages(prev => ({
                                ...prev,
                                [currentKey]: uploadedUrl
                            }));
                        }
                    } catch (err) {
                        console.error("Upload fetch error:", err);
                        toast.error(`Failed to upload ${currentKey}. Please try again.`);
                        // Reset image on failure so it doesn't get stuck
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

    const handleRemoveBg = async (key: string, mode?: "people" | "logo") => {
        const imageUrl = images[key];
        if (!imageUrl) return;

        setRemovingBgKeys(prev => new Set(prev).add(key));
        const toastId = toast.loading(`Removing background for ${key}...`);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            // Auto-detect mode if not explicitly passed
            const label = template?.image_placeholders?.find(p => p.key === key)?.label?.toLowerCase() || "";
            const isLogo = label.includes("logo") || label.includes("brand") || label.includes("badge") || label.includes("icon");
            const selectedMode = mode || (isLogo ? "logo" : bgRemovalMode || "people");

            const res = await fetch("/api/user/remove-bg", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    imageUrl,
                    mode: selectedMode
                }),
            });

            let data: any = null;
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                data = await res.json();
            } else {
                const text = await res.text().catch(() => "");
                throw new Error(text || `Background removal failed (${res.status})`);
            }

            if (!res.ok) {
                throw new Error(data?.error || "Failed to remove background");
            }

            setImages(prev => ({
                ...prev,
                [key]: data.presignedGetUrl || data.url
            }));
            if (data.freeBgRemovalsRemaining !== undefined) {
                setFreeBgRemovalsRemaining(data.freeBgRemovalsRemaining);
            }
            toast.success("Background removed successfully!", { id: toastId });
        } catch (err: any) {
            console.error("BG Removal Error:", err);
            toast.error(err.message || "Failed to remove background. Please try again.", { id: toastId });
        } finally {
            setRemovingBgKeys(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const handleFreePreview = async () => {
        if (!template || !userId) {
            toast.error("Please log in to render previews");
            return;
        }

        // 1. Check if any uploads are still in progress
        if (uploadingKeys.size > 0) {
            toast.warning("Please wait for your assets to finish uploading.");
            return;
        }

        // 2. Check if all required images are uploaded
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
            // Auto-save before preview
            const savedProjectId = await handleSave(true);
            if (!savedProjectId) {
                throw new Error("Failed to auto-save project before previewing");
            }

            // Prepare parameters
            const parameters: Record<string, string> = {};
            for (const [key, url] of Object.entries(images)) {
                if (url && url.startsWith("http")) {
                    parameters[key] = url;
                }
            }
            for (const [key, value] of Object.entries(texts)) {
                if (value) {
                    parameters[key] = value;
                }
            }

            // Call sample render API
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const res = await fetch("/api/render/sample", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    templateId: template.id,
                    parameters,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to start preview render");
            }

            if (data.renderJobId) {
                toast.success("Preview rendering started!");
                // Stay in editor: start polling in-place
                setPreviewJobId(data.renderJobId);
                setPreviewStatus("polling");
                setPreviewOutputUrl(null);
                setPreviewError(null);
                setPreviewPlainlyState(null);
                setPreviewDisplayProgress(0);
                previewPollStartRef.current = Date.now();
            } else {
                throw new Error("No render job ID returned from preview API");
            }

        } catch (error) {
            console.error("Preview error:", error);
            toast.error(`Preview failed: ${error}`);
            setIsRendering(false);
        }
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

            // Step 1: Check subscription status
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const subRes = await fetch(`/api/subscription/status`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                }
            });
            const subData = await subRes.json();

            // Check if user can render — active subscription or expired credits
            const canRender = subData.hasSubscription || (subData.hasExpiredCredits && subData.expiredCredits);
            if (!canRender) {
                toast.error("No active subscription. Please subscribe to render HD videos.");
                setIsRendering(false);
                return;
            }

            // Check render limits for active subscriptions
            if (subData.hasSubscription && subData.plan?.renderLimit && subData.warnings?.rendersExhausted) {
                toast.error(`Render limit reached (${subData.subscription?.rendersUsed}/${subData.plan.renderLimit}). Please upgrade your plan for more renders.`);
                setIsRendering(false);
                router.push("/pricing");
                return;
            }

            // For expired subscribers: check if they still have credits left
            if (!subData.hasSubscription && subData.hasExpiredCredits && subData.expiredCredits?.remaining === 0) {
                toast.error("Your expired subscription credits are exhausted. Please renew your plan.");
                router.push("/pricing");
                setIsRendering(false);
                return;
            }

            // Step 2: Start render directly (subscription-based)
            const parameters: Record<string, string> = {};
            for (const [key, url] of Object.entries(images)) {
                if (url && url.startsWith("http")) {
                    parameters[key] = url;
                }
            }
            for (const [key, value] of Object.entries(texts)) {
                if (value) {
                    parameters[key] = value;
                }
            }

            const renderRes = await fetch("/api/render", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    templateId: template.id,
                    projectId: savedProjectId,
                    parameters,
                }),
            });

            const renderData = await renderRes.json();

            if (!renderRes.ok) {
                throw new Error(renderData.error || "Failed to start render");
            }

            if (renderData.renderJobId) {
                toast.success("Render started!");
                router.push(`/render/${renderData.renderJobId}`);
            } else {
                router.push("/dashboard");
                toast.success("Render queued successfully!");
            }

        } catch (error) {
            console.error("Render error:", error);
            toast.error(`Render failed: ${error}`);
            setIsRendering(false);
        }
    };



    if (loading) {
        return (
            <main className="h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-650 animate-spin" />
            </main>
        );
    }

    if (!template) {
        return null;
    }
    return (
        <main className="min-h-screen lg:h-screen bg-white flex flex-col overflow-x-hidden lg:overflow-hidden text-slate-800 relative">
            {/* Cropper Modal */}
            <AnimatePresence>
                {showCropper && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-sm"
                    >
                        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl overflow-hidden max-w-4xl w-full flex flex-col shadow-2xl max-h-[95vh] sm:max-h-[90vh]">
                            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="bg-indigo-50 border border-indigo-100 p-2 rounded-lg">
                                        <CropIcon className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-slate-900 font-bold">Crop Image</h3>
                                        <p className="text-xs text-slate-550">
                                            Required: {template.image_placeholders?.find(p => p.key === activeImageKey)?.aspectRatio || "Free"}
                                            <span className="text-indigo-600 ml-2">
                                                ({activeAspectRatio === 1 ? "Square" : activeAspectRatio > 1 ? "Landscape" : "Portrait"})
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setShowCropper(false)} className="text-slate-500 hover:text-slate-950 transition-colors">
                                    <X />
                                </button>
                            </div>

                            <div className="px-4 sm:px-8 pb-4 flex items-center flex-wrap justify-center gap-2">
                                <div className="bg-slate-100 border border-slate-200 rounded-xl p-1 flex items-center gap-1 shadow-sm">
                                    <button
                                        onClick={() => cropperRef.current?.cropper.zoom(0.1)}
                                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => cropperRef.current?.cropper.zoom(-0.1)}
                                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="w-4 h-4" />
                                    </button>
                                    <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                                    <button
                                        onClick={() => cropperRef.current?.cropper.rotate(-90)}
                                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
                                        title="Rotate Left"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => cropperRef.current?.cropper.rotate(90)}
                                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
                                        title="Rotate Right"
                                    >
                                        <RotateCcw className="w-4 h-4 scale-x-[-1]" />
                                    </button>
                                    <div className="w-[1px] h-4 bg-slate-200 mx-1" />
                                    <button
                                        onClick={() => {
                                            cropperRef.current?.cropper.reset();
                                            cropperRef.current?.cropper.setDragMode('move');
                                        }}
                                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all"
                                        title="Reset"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="bg-slate-100 border border-slate-200 rounded-xl p-1 flex items-center gap-1 shadow-sm">
                                    <button
                                        onClick={() => cropperRef.current?.cropper.setDragMode('move')}
                                        className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-500 transition-all focus:text-indigo-600 focus:bg-indigo-50"
                                        title="Move Mode"
                                    >
                                        <Move className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => cropperRef.current?.cropper.setDragMode('crop')}
                                        className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-500 transition-all focus:text-indigo-600 focus:bg-indigo-50"
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
                                        checkCrossOrigin={true}
                                        crossOrigin="anonymous"
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

                            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                                {/* Premium Background Removal Control */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3 bg-white border border-slate-200 hover:border-slate-300 transition-all rounded-xl sm:rounded-2xl p-1.5 sm:p-2 shadow-sm">
                                        <button
                                            type="button"
                                            disabled={subscription?.isFreeUser && freeBgRemovalsRemaining !== null && freeBgRemovalsRemaining <= 0}
                                            onClick={() => setShouldRemoveBg(!shouldRemoveBg)}
                                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                                shouldRemoveBg 
                                                    ? "bg-indigo-50 text-indigo-600 border border-indigo-150 shadow-sm" 
                                                    : "text-slate-500 hover:text-slate-900 border border-transparent disabled:opacity-30 disabled:cursor-not-allowed"
                                            }`}
                                        >
                                            <Sparkles className={`w-3.5 h-3.5 transition-transform duration-300 ${shouldRemoveBg ? 'rotate-12 scale-110 text-indigo-600' : 'text-slate-400'}`} />
                                            <span>Remove Background</span>
                                            {/* Styled modern slider switch */}
                                            <div className={`w-6 h-3.5 rounded-full p-0.5 transition-all duration-300 ml-1.5 relative ${shouldRemoveBg ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                                <div className={`w-2.5 h-2.5 rounded-full bg-white transition-all duration-300 transform ${shouldRemoveBg ? 'translate-x-2.5' : 'translate-x-0'}`} />
                                            </div>
                                        </button>

                                        {shouldRemoveBg && (
                                            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setBgRemovalMode("people")}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                                                        bgRemovalMode === "people"
                                                            ? "bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 text-white shadow-sm"
                                                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                                                    }`}
                                                >
                                                    People
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setBgRemovalMode("logo")}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                                                        bgRemovalMode === "logo"
                                                            ? "bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500 text-white shadow-sm"
                                                            : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                                                    }`}
                                                >
                                                    Logo
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Usage Counter and Call-To-Action */}
                                    {subscription?.isFreeUser ? (
                                        freeBgRemovalsRemaining !== null && freeBgRemovalsRemaining <= 0 ? (
                                            <div className="text-[10px] text-rose-600 font-semibold flex items-center gap-1.5 mt-0.5 animate-pulse">
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                                <span>0 remaining daily removals. </span>
                                                <Link href="/pricing" target="_blank" className="underline text-indigo-600 hover:text-indigo-500 font-bold">
                                                    Subscribe for Bg Remover Unlimited!
                                                </Link>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                                                <Sparkles className="w-3 h-3 text-indigo-550 animate-pulse" />
                                                <span>{freeBgRemovalsRemaining ?? 3} daily free background removals remaining</span>
                                            </div>
                                        )
                                    ) : subscription?.hasSubscription ? (
                                        <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>Unlimited BG Removals active (Pro Member)</span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex items-center gap-3 ml-auto">
                                    <button
                                        onClick={() => setShowCropper(false)}
                                        className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all"
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
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Library / Upload Modal */}
            <AnimatePresence>
                {showUploadModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[90] bg-slate-900/60 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl overflow-hidden max-w-4xl w-full flex flex-col shadow-2xl max-h-[85vh] sm:max-h-[80vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl">
                                        <LucideImage className="w-5 h-5 text-indigo-650" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Image Library</h3>
                                        <p className="text-xs text-slate-500">
                                            Manage your assets for:{" "}
                                            <span className="text-indigo-600 font-bold">
                                                {template.image_placeholders?.find(p => p.key === activeImageKey)?.label || activeImageKey}
                                            </span>{" "}
                                            ({template.image_placeholders?.find(p => p.key === activeImageKey)?.aspectRatio} Aspect Ratio)
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300">
                                {/* Info Banner about Retention */}
                                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                                    <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                                    <div className="text-xs text-slate-600 leading-relaxed">
                                        <strong className="text-slate-900 block mb-0.5">Asset Retention Policy</strong>
                                        Your uploaded assets are stored securely. Free tier assets are automatically cleaned up after 7 days, and expired subscriptions after 30 days. Active Pro users enjoy permanent storage.
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                                        Select an image or upload a new one
                                    </label>

                                    {loadingRecentUploads ? (
                                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                            <span className="text-xs text-slate-500">Loading your recent uploads...</span>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                            {/* Big Upload New Image Card */}
                                            <button
                                                onClick={() => {
                                                    const fileInput = document.getElementById(`upload-${activeImageKey}`) as HTMLInputElement;
                                                    if (fileInput) fileInput.click();
                                                }}
                                                className="aspect-square w-full rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-500/50 hover:bg-indigo-50 flex flex-col items-center justify-center gap-3 p-4 group/upload-btn transition-all duration-300"
                                            >
                                                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center group-hover/upload-btn:scale-110 transition-transform">
                                                    <Upload className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-xs font-bold text-slate-800 block">Upload New</span>
                                                    <span className="text-[10px] text-slate-500 mt-1 block">Local files supported</span>
                                                </div>
                                            </button>

                                            {/* Recent Uploads Grid Items */}
                                            {recentUploads.map((asset) => (
                                                <div
                                                    key={asset.id}
                                                    onClick={() => handleSelectRecentUpload(asset.file_url)}
                                                    className="group/image-card aspect-square relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden cursor-pointer shadow-lg hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-0.5"
                                                >
                                                    <img
                                                        src={asset.file_url}
                                                        alt="Recent Upload"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover/image-card:scale-105"
                                                        loading="lazy"
                                                    />
                                                    
                                                    {/* Blur Overlay & Select Badge on Hover */}
                                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/image-card:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                                                        <div className="bg-indigo-600 text-white rounded-full p-2 shadow-lg scale-75 group-hover/image-card:scale-100 transition-transform duration-300">
                                                            <Check className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-[10px] text-white font-bold tracking-wider uppercase">Use Image</span>
                                                    </div>

                                                    {/* Retention badge showing timestamp */}
                                                    <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center pointer-events-none">
                                                        <span className="text-[8px] font-medium bg-slate-950/75 text-slate-300 px-2 py-0.5 rounded backdrop-blur-sm truncate max-w-full">
                                                            {new Date(asset.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!loadingRecentUploads && recentUploads.length === 0 && (
                                        <div className="border border-slate-250 bg-slate-50/50 rounded-2xl py-12 flex flex-col items-center justify-center text-center gap-3">
                                            <LucideImage className="w-8 h-8 text-slate-400" />
                                            <div>
                                                <p className="text-xs font-bold text-slate-500">No recent uploads available</p>
                                                <p className="text-[10px] text-slate-400 mt-1 max-w-[250px] leading-relaxed">
                                                    Upload new assets to start building your media library.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
                                <button
                                    onClick={() => setShowUploadModal(false)}
                                    className="px-6 py-2.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* Render Confirmation Modal */}
            <AnimatePresence>
                {showRenderConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl relative"
                        >
                            <button
                                onClick={() => setShowRenderConfirm(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            
                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4 border border-amber-100">
                                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Are you sure?</h3>
                                <p className="text-slate-650 text-sm">
                                    HD Renders consume credits. We highly recommend generating a <strong className="text-slate-900">Free Preview</strong> first to verify your work.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => {
                                        setShowRenderConfirm(false);
                                        handleFreePreview();
                                    }}
                                    className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold rounded-xl transition-all"
                                >
                                    Free Preview
                                </button>
                                <button
                                    onClick={() => {
                                        setShowRenderConfirm(false);
                                        handleRender();
                                    }}
                                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> Render HD
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Subscribe Popup ─────────────────────────────────── */}
            <AnimatePresence>
                {showPurchasePopup && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
                        onClick={() => setShowPurchasePopup(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl max-w-md w-full shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={() => setShowPurchasePopup(false)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="flex flex-col items-center text-center mb-6">
                                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 border border-indigo-100">
                                    <Crown className="w-8 h-8 text-amber-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Subscribe to Render</h3>
                                <p className="text-slate-500 text-sm">
                                    Subscribe to unlock HD rendering for <strong className="text-slate-900">{template?.title}</strong> and all other templates.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => { setShowPurchasePopup(false); router.push("/pricing"); }}
                                    className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <Crown className="w-5 h-5 shrink-0" />
                                        <div className="text-left">
                                            <div className="text-sm font-bold">Subscribe</div>
                                            <div className="text-xs font-normal text-indigo-200">Unlimited renders across all templates</div>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-white/80 shrink-0">View Plans →</span>
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0 z-10">
                <div className="flex items-center gap-3 md:gap-6 min-w-0">
                    <Link href={`/templates/${slug}`} className="p-2 hover:bg-slate-100 rounded-lg transition-all shrink-0">
                        <ArrowLeft className="w-5 h-5 text-slate-500 hover:text-slate-900" />
                    </Link>
                    <div className="hidden xs:block h-4 w-[1px] bg-slate-200 shrink-0" />
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            onBlur={() => handleSave(true)}
                            placeholder="Celite Project 1"
                            className="bg-transparent border-none text-slate-900 font-semibold truncate text-sm md:text-base focus:outline-none focus:ring-1 focus:ring-slate-200 rounded px-1 min-w-[120px]"
                        />
                        <span className="hidden lg:inline-block text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600 shrink-0">
                            {projectId ? "Saved" : "Draft"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    {/* Preview Tracker for Free Users */}
                    {!subscription?.hasSubscription && subscription?.subscription && (
                        <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold text-slate-500 uppercase leading-none mb-1">Free Previews</span>
                                <span className="text-[10px] font-bold text-slate-900 leading-none">
                                    {subscription.subscription.previewsUsed} / {subscription.subscription.previewLimit}
                                </span>
                            </div>
                            <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${Number(subscription.subscription.previewPercent) >= 90 ? 'bg-red-500' :
                                        Number(subscription.subscription.previewPercent) >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                                        }`}
                                    style={{ width: `${Math.min(Number(subscription.subscription.previewPercent), 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => handleSave()}
                        disabled={isSaving}
                        className="hidden xs:flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-200/80 hover:bg-slate-100 rounded-lg text-sm text-slate-700 hover:text-slate-900 transition-colors shrink-0 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <Save className="w-4 h-4" />}
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                        onClick={() => {
                            if (!subscription?.hasSubscription && subscription?.warnings?.previewsExhausted) {
                                toast.error("Free preview limit reached. Upgrade for unlimited previews!");
                                router.push("/pricing");
                                return;
                            }
                            handleFreePreview();
                        }}
                        disabled={isRendering || uploadingKeys.size > 0}
                        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 shrink-0"
                        title={
                            subscription?.hasSubscription
                                ? "Preview your edits (Unlimited)"
                                : subscription?.warnings?.previewsExhausted
                                    ? "Preview limit reached. Upgrade to continue."
                                    : `Preview your edits (${subscription?.subscription?.previewsUsed}/${subscription?.subscription?.previewLimit} used)`
                        }
                    >
                        {isRendering ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                        ) : (
                            <Eye className="w-4 h-4" />
                        )}
                        <span className="hidden xs:inline">Free Preview</span>
                        <span className="xs:hidden">Preview</span>
                    </button>
                    <button
                        onClick={() => {
                            // Subscription exhausted? Treat as "no valid render right"
                            const subExhausted = subscription?.hasSubscription
                                && subscription?.plan?.renderLimit
                                && subscription?.warnings?.rendersExhausted;

                            const canRenderViaSubscription =
                                subscription?.hasSubscription && !subExhausted;
                            const canRenderViaExpiredCredits =
                                subscription?.hasExpiredCredits && subscription?.expiredCredits
                                && subscription?.expiredCredits?.remaining > 0;

                            const canRender = canRenderViaSubscription || canRenderViaExpiredCredits;

                            if (canRender) {
                                setShowRenderConfirm(true);
                            } else {
                                // No valid subscription — prompt to subscribe
                                setShowPurchasePopup(true);
                            }
                        }}
                        disabled={isRendering || uploadingKeys.size > 0}
                        className="flex items-center gap-2 px-3 sm:px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] xs:text-xs md:text-sm font-bold shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        {isRendering ? (
                            <><Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> <span className="hidden xs:inline">Processing...</span></>
                        ) : (
                            <>
                                {uploadingKeys.size > 0 ? (
                                    <><Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" /> <span className="hidden xs:inline">Uploading...</span></>
                                ) : (
                                    (() => {
                                        const subExhausted = subscription?.hasSubscription
                                            && subscription?.plan?.renderLimit
                                            && subscription?.warnings?.rendersExhausted;
                                        const canRenderNormally = (subscription?.hasSubscription && !subExhausted)
                                            || subscription?.hasExpiredCredits;
                                        return canRenderNormally
                                            ? <><Download className="w-3 h-3 sm:w-4 sm:h-4" /> Render HD</>
                                            : <><Crown className="w-3 h-3 sm:w-4 sm:h-4" /> {subExhausted ? "Quota Full" : "Render HD"}</>;
                                    })()
                                )}
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden relative">
                <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden">
                    {/* Canvas Preview */}
                    <div className="w-full lg:flex-1 bg-slate-50 flex flex-col items-center justify-start p-3 lg:p-4 relative min-h-[250px] lg:min-h-0 lg:sticky lg:top-0 z-30 border-b border-slate-200 shadow-sm lg:shadow-none transition-all duration-300 gap-3 overflow-y-auto">
                        <div
                            className="w-full max-w-[96%] bg-white border border-slate-200/80 shadow-lg relative overflow-hidden flex flex-col items-center justify-center group"
                            style={{
                                aspectRatio: template?.aspect_ratio
                                    ? template.aspect_ratio.replace(':', '/')
                                    : '16/9',
                                maxHeight: '45vh',
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50" />

                            {/* ── Show preview video when completed ── */}
                            {previewStatus === "completed" && previewOutputUrl ? (
                                <div className="relative w-full h-full flex items-center justify-center">
                                    <video
                                        ref={previewVideoRef}
                                        src={previewOutputUrl}
                                        className="w-full h-full object-contain"
                                        controls
                                        autoPlay
                                        muted
                                        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                        onLoadedMetadata={(e) => {
                                            if (e.currentTarget.duration) setVideoDuration(e.currentTarget.duration);
                                        }}
                                    />
                                    {/* Overlay bar at top */}
                                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-slate-950/70 to-transparent z-20">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Preview Ready</span>
                                        </div>
                                        <button
                                            onClick={resetPreview}
                                            className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-semibold text-white hover:text-slate-100 bg-slate-950/40 hover:bg-slate-950/60 rounded-md transition-all backdrop-blur-sm"
                                        >
                                            <Edit3 className="w-2.5 h-2.5" />
                                            Edit Again
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* ── Default: show template preview video ── */
                                <>
                                    {template?.preview_url ? (
                                        <div className="relative w-full h-full flex items-center justify-center">
                                            <video
                                                ref={videoRef}
                                                src={template.preview_url}
                                                className={`w-full h-full object-contain transition-all duration-300 ${previewStatus === "polling" ? "blur-md scale-[1.02]" : ""}`}
                                                loop
                                                muted
                                                playsInline
                                                controls={previewStatus !== "polling"}
                                                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                                onLoadedMetadata={(e) => {
                                                    if (e.currentTarget.duration) setVideoDuration(e.currentTarget.duration);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className={`flex flex-col items-center gap-4 text-slate-350 ${previewStatus === "polling" ? "blur-md" : ""}`}>
                                            <div className="p-4 lg:p-6 border-2 border-dashed border-slate-200 rounded-full">
                                                <LucideImage className="w-8 h-8 lg:w-12 lg:h-12" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400">No preview available</span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Rendering overlay: blurred bg + loader ── */}
                            <AnimatePresence>
                                {previewStatus === "polling" && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-md px-6"
                                    >
                                        <div className="w-full max-w-xs text-center">
                                            {/* Elegant Pulsing Badge */}
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 border border-slate-200 text-[9px] font-bold text-slate-650 tracking-wider uppercase mb-4 shadow-sm">
                                                <span className="w-1.5 h-1.5 bg-indigo-650 rounded-full animate-pulse" />
                                                {previewPlainlyState === "DONE" ? "Finalizing" : previewPlainlyState === "IN_PROGRESS" ? "Rendering" : "Initializing"}
                                            </div>

                                            <h3 className="text-base font-semibold text-white tracking-tight mb-1">
                                                Creating Preview
                                            </h3>

                                            <p className="text-xs text-slate-200 mb-6 min-h-[16px]">
                                                {previewPlainlyState === "IN_PROGRESS"
                                                    ? "Rendering preview frames..."
                                                    : previewPlainlyState === "DONE"
                                                        ? "Saving cloud preview..."
                                                        : "Preparing video engine..."
                                                }
                                            </p>

                                            {/* Sleek Progress Bar */}
                                            <div className="relative mb-2">
                                                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                                        style={{
                                                            width: `${previewDisplayProgress}%`,
                                                            transition: "width 0.3s cubic-bezier(0.1, 0.8, 0.25, 1)"
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-200 font-medium">
                                                <span>Progress</span>
                                                <span className="font-mono text-white font-bold">{Math.round(previewDisplayProgress)}%</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── Failed overlay ── */}
                            <AnimatePresence>
                                {previewStatus === "failed" && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm"
                                    >
                                        <XCircle className="w-10 h-10 text-red-400 mb-3" />
                                        <p className="text-sm font-bold text-white mb-1">Preview Failed</p>
                                        <p className="text-[10px] text-slate-200 mb-4 max-w-[250px] text-center">{previewError || "Something went wrong."}</p>
                                        <button
                                            onClick={resetPreview}
                                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-500 rounded-xl transition-all"
                                        >
                                            <RefreshCw className="w-3 h-3" />
                                            Try Again
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {/* ── Label ── */}
                            <div className="absolute top-4 left-4 text-[10px] font-mono text-slate-400 z-10">
                                {previewStatus === "completed" ? "FREE PREVIEW" : "TEMPLATE PREVIEW"}
                            </div>
                        </div>

                        {/* Timeline Editor */}
                        {(() => {
                            interface TimelineLayer {
                                type: "image" | "text";
                                index: number;
                                key: string;
                                label: string;
                                previewTimestamp: number;
                                aspectRatio?: string;
                                referenceImageUrl?: string;
                                defaultValue?: string;
                            }

                            // Collect all layers
                            const allLayers: TimelineLayer[] = [];
                            template.image_placeholders?.forEach((placeholder, idx) => {
                                allLayers.push({
                                    type: "image",
                                    index: idx,
                                    key: placeholder.key,
                                    label: placeholder.label,
                                    previewTimestamp: placeholder.previewTimestamp ?? 0,
                                    aspectRatio: placeholder.aspectRatio,
                                    referenceImageUrl: placeholder.referenceImageUrl
                                });
                            });
                            template.text_placeholders?.forEach((placeholder, idx) => {
                                allLayers.push({
                                    type: "text",
                                    index: idx,
                                    key: placeholder.key,
                                    label: placeholder.label,
                                    previewTimestamp: placeholder.previewTimestamp ?? 0,
                                    defaultValue: placeholder.defaultValue
                                });
                            });

                            // Get sorted unique timestamps
                            const uniqueTimestamps = [...new Set(allLayers.map(l => l.previewTimestamp))].sort((a, b) => a - b);

                            // End time for a timestamp = next unique timestamp, or videoDuration
                            const getEndTime = (ts: number): number => {
                                const nextTs = uniqueTimestamps.find(t => t > ts);
                                return nextTs !== undefined ? nextTs : videoDuration;
                            };

                            // Group layers by timestamp (images first, then text within each group)
                            const groups: { ts: number; endTime: number; layers: TimelineLayer[] }[] = uniqueTimestamps.map(ts => ({
                                ts,
                                endTime: getEndTime(ts),
                                layers: allLayers
                                    .filter(l => l.previewTimestamp === ts)
                                    .sort((a, b) => {
                                        if (a.type !== b.type) return a.type === "image" ? -1 : 1;
                                        return a.key.localeCompare(b.key);
                                    })
                            }));

                            // Max stacked layers at any single timestamp determines total track height
                            const maxStack = Math.max(1, ...groups.map(g => g.layers.length));
                            const LAYER_H = isTimelineExpanded ? 52 : 36; // px per layer row (larger when expanded)
                            const GAP = 4;
                            const totalHeight = maxStack * (LAYER_H + GAP);

                            return (
                                <div className="w-full max-w-[96%] bg-white border border-slate-200/80 rounded-2xl p-4 shadow-md flex flex-col gap-3 relative overflow-hidden transition-all duration-300">
                                    {/* Header */}
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-2 border-b border-slate-100 select-none flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-800 font-bold uppercase tracking-wider text-[10px]">Timeline</span>
                                            <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200/60">
                                                {currentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Zoom Controls */}
                                            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 mr-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setTimelineZoom(prev => Math.max(1, prev - 1)); }}
                                                    disabled={timelineZoom === 1}
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                                    title="Zoom Out"
                                                >
                                                    <ZoomOut className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="text-[9px] font-mono font-bold text-slate-600 px-1.5 min-w-[24px] text-center">
                                                    {timelineZoom}x
                                                </span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setTimelineZoom(prev => Math.min(8, prev + 1)); }}
                                                    disabled={timelineZoom === 8}
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-all disabled:opacity-30 disabled:pointer-events-none"
                                                    title="Zoom In"
                                                >
                                                    <ZoomIn className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            {/* Expand/Collapse Toggle */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setIsTimelineExpanded(!isTimelineExpanded); }}
                                                className={`p-1 bg-slate-100 border border-slate-200 hover:bg-slate-200 hover:text-slate-800 rounded-lg text-slate-500 transition-all ${
                                                    isTimelineExpanded ? 'text-indigo-650 border-indigo-500/30 bg-indigo-50' : ''
                                                }`}
                                                title={isTimelineExpanded ? "Collapse Timeline Height" : "Expand Timeline Height"}
                                            >
                                                {isTimelineExpanded ? (
                                                    <Minimize2 className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Horizontal Scroll Wrapper */}
                                    <div 
                                        ref={timelineScrollRef}
                                        onMouseDown={handleTimelineMouseDown}
                                        className="relative w-full overflow-x-auto select-none [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 pb-1 cursor-grab active:cursor-grabbing"
                                    >
                                        <div 
                                            className="relative transition-all duration-200"
                                            style={{ width: `${timelineZoom * 100}%`, minWidth: '100%' }}
                                        >
                                            {/* Ruler */}
                                            <div 
                                                onClick={handleRulerClick}
                                                className="h-6 w-full relative border-b border-slate-100 cursor-pointer flex items-end pb-0.5"
                                            >
                                                {(() => {
                                                    // Dynamically calculate ruler tick interval based on zoom level and duration
                                                    const visibleSecs = videoDuration / timelineZoom;
                                                    const interval = visibleSecs <= 6 ? 0.5 : visibleSecs <= 12 ? 1 : visibleSecs <= 30 ? 2 : 5;
                                                    const ticks: number[] = [];
                                                    for (let t = 0; t <= videoDuration; t += interval) {
                                                        ticks.push(t);
                                                    }

                                                    return ticks.map((t) => {
                                                        const percent = (t / videoDuration) * 100;
                                                        if (percent > 100) return null;

                                                        const label = t % 1 === 0 ? `${t}s` : `${t.toFixed(1)}s`;
                                                        const isMajor = t % 1 === 0;
                                                        return (
                                                            <div 
                                                                key={`ruler-${t}`} 
                                                                className="absolute flex flex-col items-center -translate-x-1/2"
                                                                style={{ left: `${percent}%` }}
                                                            >
                                                                <span className={`font-mono text-slate-400 font-bold ${isMajor ? 'text-[8px]' : 'text-[7px] text-slate-300'}`}>{label}</span>
                                                                <div className={`w-[1px] bg-slate-200 mt-0.5 ${isMajor ? 'h-1.5' : 'h-0.5 bg-slate-100'}`} />
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>

                                            {/* Single Track Area */}
                                            <div 
                                                className="relative w-full mt-1"
                                                style={{ height: `${totalHeight}px` }}
                                                onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const clickX = e.clientX - rect.left;
                                                    const newTime = (clickX / rect.width) * videoDuration;
                                                    if (previewStatus === "completed" && previewVideoRef.current) {
                                                        previewVideoRef.current.currentTime = newTime;
                                                    } else if (videoRef.current) {
                                                        videoRef.current.currentTime = newTime;
                                                    }
                                                    setCurrentTime(newTime);
                                                }}
                                            >
                                                {/* Playhead */}
                                                <div 
                                                    className="absolute top-0 bottom-0 w-[1.5px] bg-red-500 z-30 pointer-events-none"
                                                    style={{ left: `${Math.min(100, (currentTime / videoDuration) * 100)}%` }}
                                                >
                                                    <div className="absolute -top-1 -left-[5px] w-3 h-3 bg-red-500 rounded-full border border-white shadow-md shadow-red-500/40" />
                                                </div>

                                                {/* Blocks — one row per unique timestamp, stacking within same ts */}
                                                {groups.map((group) => {
                                                    const leftPct = (group.ts / videoDuration) * 100;
                                                    const dur = Math.max(0.3, group.endTime - group.ts);
                                                    const widthPct = (dur / videoDuration) * 100;

                                                    return group.layers.map((layer, stackIdx) => {
                                                        const isActive = activePlaceholder === layer.key;
                                                        const isImage = layer.type === "image";
                                                        const topPx = stackIdx * (LAYER_H + GAP);

                                                        return (
                                                            <div
                                                                key={`block-${layer.key}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActivePlaceholder(layer.key);
                                                                    seekTo(group.ts);
                                                                    if (!isImage) {
                                                                        // Focus text input for text blocks
                                                                        const textInput = document.getElementById(`input-${layer.key}`) as HTMLInputElement;
                                                                        if (textInput) {
                                                                            textInput.scrollIntoView({ behavior: "smooth", block: "nearest" });
                                                                            textInput.focus();
                                                                        }
                                                                    }
                                                                }}
                                                                onDoubleClick={(e) => {
                                                                    if (isImage) {
                                                                        e.stopPropagation();
                                                                        setActivePlaceholder(layer.key);
                                                                        seekTo(group.ts);
                                                                        setActiveImageKey(layer.key);
                                                                        setShowUploadModal(true);
                                                                        fetchRecentUploads();
                                                                    }
                                                                }}
                                                                style={{
                                                                    left: `${leftPct}%`,
                                                                    width: `${Math.max(2, widthPct)}%`,
                                                                    top: `${topPx}px`,
                                                                    height: `${LAYER_H}px`,
                                                                }}
                                                                className={`absolute rounded-md border overflow-hidden cursor-pointer transition-all z-20 flex items-center ${
                                                                    isActive
                                                                        ? isImage
                                                                            ? "bg-indigo-50 border-indigo-400 shadow-[0_0_12px_rgba(79,70,229,0.15)]"
                                                                            : "bg-blue-50 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                                                                        : isImage
                                                                            ? "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                                                                            : "bg-blue-50 border-blue-100 hover:bg-blue-100/60 hover:border-blue-200"
                                                                }`}
                                                            >
                                                                {/* Icon / thumbnail */}
                                                                {isImage ? (
                                                                    (() => {
                                                                        const imgSrc = images[layer.key] || layer.referenceImageUrl;
                                                                        return imgSrc ? (
                                                                            <img src={imgSrc} alt="" className="h-full w-8 object-cover shrink-0 border-r border-slate-200 pointer-events-none" />
                                                                        ) : (
                                                                            <div className="h-full w-7 bg-slate-100 flex items-center justify-center shrink-0 border-r border-slate-200 pointer-events-none">
                                                                                <LucideImage className="w-3 h-3 text-slate-400" />
                                                                            </div>
                                                                        );
                                                                    })()
                                                                ) : (
                                                                    <div className="h-full w-7 bg-blue-50 flex items-center justify-center shrink-0 border-r border-blue-100 pointer-events-none">
                                                                        <Type className="w-3 h-3 text-blue-500" />
                                                                    </div>
                                                                )}

                                                                {/* Label / Inline Edit */}
                                                                {isImage ? (
                                                                    <div className="px-1.5 truncate select-none pointer-events-none min-w-0">
                                                                        {uploadingKeys.has(layer.key) ? (
                                                                            <span className="text-[8px] font-bold text-indigo-650 animate-pulse flex items-center gap-1">
                                                                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Uploading...
                                                                            </span>
                                                                        ) : removingBgKeys.has(layer.key) ? (
                                                                            <span className="text-[8px] font-bold text-indigo-655 animate-pulse flex items-center gap-1">
                                                                                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Removing BG...
                                                                            </span>
                                                                        ) : (
                                                                            <span className={`text-[9px] font-bold truncate leading-tight ${
                                                                                isActive ? "text-slate-800" : "text-slate-600"
                                                                            }`}>
                                                                                {layer.label}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <input
                                                                        className={`flex-1 min-w-0 bg-transparent border-none outline-none text-[9px] font-bold px-1.5 truncate ${
                                                                            isActive ? "text-slate-800" : "text-blue-800"
                                                                        } placeholder:text-slate-400`}
                                                                        value={texts[layer.key] || ""}
                                                                        placeholder={layer.defaultValue || layer.label}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={(e) => setTexts(prev => ({ ...prev, [layer.key]: e.target.value }))}
                                                                        onFocus={() => {
                                                                            setActivePlaceholder(layer.key);
                                                                            seekTo(group.ts);
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                    </div>

                    {/* Dynamic Asset Panel */}
                    <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-50/60 p-5 pb-16 flex flex-col gap-4 shrink-0 overflow-visible lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:bg-transparent">
                        {(() => {
                            const activeImgPlaceholder = template.image_placeholders?.find(p => p.key === activePlaceholder);
                            const activeTxtPlaceholder = template.text_placeholders?.find(p => p.key === activePlaceholder);
                            
                            if (activeImgPlaceholder) {
                                const placeholder = activeImgPlaceholder;
                                const isUploaded = !!images[placeholder.key];
                                const currentImageSrc = images[placeholder.key] || placeholder.referenceImageUrl;
                                return (
                                    <div className="flex flex-col gap-5">
                                        {/* Properties Header */}
                                        <div className="flex flex-col gap-1 border-b border-slate-200/80 pb-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] bg-indigo-50 text-indigo-650 border border-indigo-150 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Image Asset</span>
                                                <span className="text-[10px] text-slate-400 font-mono">Key: {placeholder.key}</span>
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mt-2">{placeholder.label}</h3>
                                            <span className="text-[10px] text-slate-500 font-medium">Required ratio: <strong className="text-slate-700 font-mono">{placeholder.aspectRatio}</strong></span>
                                        </div>

                                        {/* Large visual preview container */}
                                        <div className="space-y-3">
                                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Asset Preview</label>
                                            
                                            <div className="relative group/sidebar-preview w-full rounded-2xl border border-slate-200 bg-slate-100/50 overflow-hidden flex flex-col items-center justify-center p-3 transition-all duration-300 hover:border-indigo-500/30">
                                                <div 
                                                    style={{ aspectRatio: parseAspectRatio(placeholder.aspectRatio).ratio }} 
                                                    className="w-full relative rounded-xl overflow-hidden bg-slate-200/55 flex items-center justify-center border border-slate-200 max-h-[220px]"
                                                >
                                                    {isUploaded && placeholder.referenceImageUrl && (
                                                        <img 
                                                            src={placeholder.referenceImageUrl} 
                                                            alt="Reference guide shadow" 
                                                            className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
                                                        />
                                                    )}
                                                    
                                                    {currentImageSrc ? (
                                                        <img 
                                                            src={currentImageSrc} 
                                                            alt={placeholder.label} 
                                                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl z-10"
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center gap-3 py-10">
                                                            <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center">
                                                                <LucideImage className="w-5 h-5 text-slate-400" />
                                                            </div>
                                                            <span className="text-[10px] text-slate-550 uppercase tracking-widest font-bold">No Image Uploaded</span>
                                                        </div>
                                                    )}

                                                    {/* Floating Small Remove Button in Corner */}
                                                    {isUploaded && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setImages(prev => ({ ...prev, [placeholder.key]: null }));
                                                            }}
                                                            className="absolute top-2 right-2 z-20 p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-full border border-slate-200 transition-all shadow-md hover:scale-110 active:scale-95"
                                                            title="Remove Image"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Upload controls & AI Background Remover */}
                                        <div className="space-y-3 mt-2">
                                            <input
                                                type="file"
                                                className="hidden"
                                                id={`upload-${placeholder.key}`}
                                                accept="image/*"
                                                onChange={(e) => handleFileChange(e, placeholder)}
                                            />
                                            
                                            <button
                                                onClick={() => {
                                                    setActiveImageKey(placeholder.key);
                                                    setShowUploadModal(true);
                                                    fetchRecentUploads();
                                                }}
                                                className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm relative overflow-hidden"
                                            >
                                                {uploadingKeys.has(placeholder.key) ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin text-indigo-650" /> Uploading...</>
                                                ) : (
                                                    <><Upload className="w-4 h-4 text-indigo-600" /> {isUploaded ? 'Replace Image' : 'Upload Image'}</>
                                                )}
                                            </button>

                                            {isUploaded && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={() => {
                                                                const imgUrl = images[placeholder.key];
                                                                if (!imgUrl) return;
                                                                if (imgUrl.startsWith("data:") || imgUrl.startsWith("blob:")) {
                                                                    setImageToCrop(imgUrl);
                                                                    setActiveImageKey(placeholder.key);
                                                                    const parsed = parseAspectRatio(placeholder.aspectRatio);
                                                                    setActiveAspectRatio(parsed.ratio);
                                                                    setTargetDimensions({ width: parsed.width, height: parsed.height });
                                                                    setShowCropper(true);
                                                                } else {
                                                                    const toastId = toast.loading("Preparing image for cropping...");
                                                                    fetch(`/api/user/proxy-image?url=${encodeURIComponent(imgUrl)}`)
                                                                        .then(res => {
                                                                            if (!res.ok) throw new Error("Network error downloading image");
                                                                            return res.blob();
                                                                        })
                                                                        .then(blob => {
                                                                            const localUrl = URL.createObjectURL(blob);
                                                                            setImageToCrop(localUrl);
                                                                            setActiveImageKey(placeholder.key);
                                                                            const parsed = parseAspectRatio(placeholder.aspectRatio);
                                                                            setActiveAspectRatio(parsed.ratio);
                                                                            setTargetDimensions({ width: parsed.width, height: parsed.height });
                                                                            setShowCropper(true);
                                                                            toast.dismiss(toastId);
                                                                        })
                                                                        .catch(err => {
                                                                            console.error("CORS crop error:", err);
                                                                            toast.error("Failed to load image for cropping. Re-uploading may be needed.", { id: toastId });
                                                                        });
                                                                }
                                                            }}
                                                            className="py-2 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                                                        >
                                                            <CropIcon className="w-3.5 h-3.5 text-slate-500" /> Recrop
                                                        </button>

                                                        {removingBgKeys.has(placeholder.key) ? (
                                                            <button
                                                                disabled
                                                                className="py-2 px-3 bg-indigo-50 border border-indigo-150 text-indigo-650 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5"
                                                            >
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Removing...
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setShowBgMenu(showBgMenu === placeholder.key ? null : placeholder.key)}
                                                                className={`py-2 px-3 border text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                                                                    showBgMenu === placeholder.key
                                                                        ? "bg-indigo-600 text-white border-indigo-500"
                                                                        : "bg-indigo-50 border border-indigo-150 hover:bg-indigo-100/60 text-indigo-650"
                                                                }`}
                                                            >
                                                                <Sparkles className="w-3.5 h-3.5" /> Remove BG
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Mode Selector Popover below button */}
                                                    {showBgMenu === placeholder.key && !removingBgKeys.has(placeholder.key) && (
                                                        <div className="flex flex-col gap-2 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl mt-2 select-none">
                                                            <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider text-center">Detect Subject Type</span>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    disabled={subscription?.isFreeUser && freeBgRemovalsRemaining !== null && freeBgRemovalsRemaining <= 0}
                                                                    onClick={() => {
                                                                        handleRemoveBg(placeholder.key, "people");
                                                                        setShowBgMenu(null);
                                                                    }}
                                                                    className="flex-1 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                                                                >
                                                                    People
                                                                </button>
                                                                <button
                                                                    disabled={subscription?.isFreeUser && freeBgRemovalsRemaining !== null && freeBgRemovalsRemaining <= 0}
                                                                    onClick={() => {
                                                                        handleRemoveBg(placeholder.key, "logo");
                                                                        setShowBgMenu(null);
                                                                    }}
                                                                    className="flex-1 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1"
                                                                >
                                                                    Object/Logo
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowBgMenu(null)}
                                                                    className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[11px] rounded-lg transition-all"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {subscription?.isFreeUser ? (
                                                        freeBgRemovalsRemaining !== null && freeBgRemovalsRemaining <= 0 ? (
                                                            <div className="text-[10px] text-rose-600 font-semibold text-center mt-2 flex flex-col gap-0.5">
                                                                <span>0 free AI removals left today.</span>
                                                                <Link href="/pricing" target="_blank" className="text-indigo-650 hover:text-indigo-755 underline font-bold">
                                                                    Upgrade to Pro for Unlimited!
                                                                </Link>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-indigo-650/90 font-semibold text-center mt-2">
                                                                <span>{freeBgRemovalsRemaining ?? 3} free removals left today • </span>
                                                                <Link href="/pricing" target="_blank" className="underline hover:text-indigo-755 font-bold">
                                                                    Upgrade
                                                                </Link>
                                                            </div>
                                                        )
                                                    ) : subscription?.hasSubscription ? (
                                                        <div className="text-[10px] text-emerald-600 font-semibold text-center mt-2">
                                                            Unlimited removals (Pro Member)
                                                        </div>
                                                    ) : null}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            if (activeTxtPlaceholder) {
                                const placeholder = activeTxtPlaceholder;
                                const textVal = texts[placeholder.key] || "";
                                return (
                                    <div className="flex flex-col gap-5">
                                        {/* Properties Header */}
                                        <div className="flex flex-col gap-1 border-b border-slate-200/80 pb-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] bg-blue-50 text-blue-650 border border-blue-150 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Text Asset</span>
                                                <span className="text-[10px] text-slate-400 font-mono">Key: {placeholder.key}</span>
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mt-2">{placeholder.label}</h3>
                                        </div>

                                        {/* Detailed Text Input Area */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Configure Text</label>
                                                <span className="text-[10px] text-slate-400 font-mono">{textVal.length} chars</span>
                                            </div>
                                            
                                            <div className="relative group">
                                                <textarea
                                                    id={`input-${placeholder.key}`}
                                                    className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 px-4 text-sm text-slate-800 focus:outline-none transition-all placeholder:text-slate-400 min-h-[120px] resize-none"
                                                    value={textVal}
                                                    onChange={(e) => setTexts(prev => ({ ...prev, [placeholder.key]: e.target.value }))}
                                                    placeholder={placeholder.defaultValue || `Enter ${placeholder.label}...`}
                                                />
                                            </div>

                                            {/* Helper/Reset block */}
                                            {placeholder.defaultValue && (
                                                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                                                    <span className="truncate max-w-[180px]">Default: &quot;{placeholder.defaultValue}&quot;</span>
                                                    <button 
                                                        onClick={() => setTexts(prev => ({ ...prev, [placeholder.key]: placeholder.defaultValue }))}
                                                        className="text-indigo-650 hover:text-indigo-755 font-semibold transition-all hover:underline"
                                                    >
                                                        Reset to Default
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            // Fallback Navigator (if activePlaceholder is null or template data is loading)
                            return (
                                <div className="flex flex-col items-center justify-center text-center py-10 gap-4 h-full">
                                    <div className="p-4 bg-indigo-50 rounded-full border border-indigo-100">
                                        <Sparkles className="w-6 h-6 text-indigo-600 animate-pulse" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Select an Asset</p>
                                        <p className="text-xs text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                                            Click on any layer block in the timeline to open its properties editor.
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}


                    </aside>
                </div>
            </div>
        </main>
    );
}
