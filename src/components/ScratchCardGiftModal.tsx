// agent-notes: { ctx: "Interactive scratch card modal awarding 10 free credits to new users", deps: ["src/lib/supabase.ts", "canvas-confetti"], state: active, last: "sato@2026-08-24" }
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Gift, X, Loader2, Check, Video, HardDrive, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { usePathname } from "next/navigation";

export default function ScratchCardGiftModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isScratched, setIsScratched] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [isClaimed, setIsClaimed] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawing = useRef(false);
    const pathname = usePathname();

    // Check if user is eligible for the welcome gift
    const checkEligibility = useCallback(async () => {
        try {
            if (!supabase) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;

            setUserId(session.user.id);
            const token = session.access_token;

            const res = await fetch("/api/user/claim-signup-gift", {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.eligible) {
                    // Smooth 400ms delay for delightful presentation
                    setTimeout(() => setIsOpen(true), 400);
                }
            }
        } catch (error) {
            console.error("Failed to check gift eligibility:", error);
        }
    }, []);

    useEffect(() => {
        // Initial check on mount & pathname changes
        checkEligibility();

        // Listen for active auth changes (e.g. immediate login or signup)
        let authSub: any = null;
        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
                if (session?.user && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION")) {
                    checkEligibility();
                }
            });
            authSub = subscription;
        }

        const handleOpenEvent = () => {
            checkEligibility();
            setIsOpen(true);
        };

        window.addEventListener("celite-open-signup-gift", handleOpenEvent);
        return () => {
            window.removeEventListener("celite-open-signup-gift", handleOpenEvent);
            authSub?.unsubscribe?.();
        };
    }, [checkEligibility, pathname]);

    // Initialize the canvas scratch layer
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Reset
        ctx.globalCompositeOperation = "source-over";

        // Draw metallic gradient scratch surface
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#CBD5E1");
        gradient.addColorStop(0.3, "#E2E8F0");
        gradient.addColorStop(0.5, "#CBD5E1");
        gradient.addColorStop(0.7, "#94A3B8");
        gradient.addColorStop(1, "#64748B");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add subtle patterned glitter dots
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            ctx.beginPath();
            ctx.arc(x, y, Math.random() * 2.5 + 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Instruction Text
        ctx.fillStyle = "#1E293B";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✨ SCRATCH TO REVEAL ✨", width / 2, height / 2 - 10);

        ctx.fillStyle = "#64748B";
        ctx.font = "12px sans-serif";
        ctx.fillText("Rub with your finger or mouse", width / 2, height / 2 + 15);
    }, []);

    useEffect(() => {
        if (isOpen && !isScratched) {
            // Wait for modal transition then initialize canvas
            const timer = setTimeout(() => {
                initCanvas();
            }, 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isScratched, initCanvas]);

    // Calculate how much has been scratched off
    const checkScratchedPercentage = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let transparentPixels = 0;

        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] === 0) {
                transparentPixels++;
            }
        }

        const percentage = (transparentPixels / (pixels.length / 4)) * 100;
        if (percentage > 35 && !isScratched) {
            revealPrize();
        }
    };

    const scratch = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();

        checkScratchedPercentage();
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        isDrawing.current = true;
        scratch(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        scratch(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        isDrawing.current = true;
        const touch = e.touches[0];
        scratch(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return;
        const touch = e.touches[0];
        scratch(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => {
        isDrawing.current = false;
    };

    const revealPrize = () => {
        setIsScratched(true);
        try {
            confetti({
                particleCount: 90,
                spread: 70,
                origin: { y: 0.6 }
            });
        } catch (e) {
            console.error("Confetti error:", e);
        }
    };

    const handleClaim = async () => {
        setIsClaiming(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error("Please log in to claim your gift");

            const res = await fetch("/api/user/claim-signup-gift", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to claim gift");
            }

            setIsClaimed(true);

            // Grand Confetti Blast
            try {
                confetti({
                    particleCount: 160,
                    spread: 100,
                    origin: { y: 0.5 }
                });
            } catch (e) {}

            toast.success("🎁 10 Free HD Credits added to your account!");

            // Notify Header to refresh credits counter
            window.dispatchEvent(new Event("focus"));

            setTimeout(() => {
                setIsOpen(false);
            }, 2200);
        } catch (error) {
            console.error("Claim gift error:", error);
            toast.error(error instanceof Error ? error.message : "Failed to claim gift");
        } finally {
            setIsClaiming(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: 20 }}
                    className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200"
                >
                    {/* Header Ambient Glow */}
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-br from-rose-500/20 via-amber-400/20 to-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

                    {/* Close Button */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-20 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-6 sm:p-8 text-center relative z-10">
                        {/* Gift Badge */}
                        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-indigo-500/10 border border-rose-200 text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-4 shadow-sm">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>First-Time Signup Gift</span>
                        </div>

                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 tracking-tight">
                            Scratch & Win Your Gift! 🎁
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mb-6 font-normal">
                            Welcome to CelitePro! Scratch the card below to reveal your exclusive welcome reward.
                        </p>

                        {/* Interactive Scratch Card Box */}
                        <div className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden shadow-inner border-2 border-dashed border-amber-300/80 bg-gradient-to-br from-amber-50 via-rose-50 to-indigo-50 flex flex-col items-center justify-center p-6 select-none">
                            {/* Underneath Reward Card */}
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 flex items-center justify-center text-white mb-2 shadow-md animate-bounce">
                                    <Gift className="w-7 h-7" />
                                </div>
                                <div className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-rose-600 via-amber-500 to-indigo-600">
                                    10 FREE CREDITS
                                </div>
                                <p className="text-xs font-bold text-slate-700 mt-1">
                                    Full HD Video Renders • Free Storage
                                </p>
                            </div>

                            {/* Scratch Canvas Surface */}
                            {!isScratched && (
                                <canvas
                                    ref={canvasRef}
                                    width={380}
                                    height={237}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                                />
                            )}
                        </div>

                        {/* Quick Scratch Shortcut */}
                        {!isScratched && (
                            <button
                                type="button"
                                onClick={revealPrize}
                                className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-bold underline cursor-pointer"
                            >
                                Can't scratch? Click here to reveal gift
                            </button>
                        )}

                        {/* Action Area */}
                        {isScratched && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 space-y-4"
                            >
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-emerald-700">
                                    <Check className="w-4 h-4 text-emerald-600" />
                                    <span>Reward Unlocked: 10 Render Credits (30 Days Free)</span>
                                </div>

                                <button
                                    onClick={handleClaim}
                                    disabled={isClaiming || isClaimed}
                                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-600 hover:brightness-110 text-white font-extrabold text-sm shadow-xl shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isClaiming ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Adding Credits to Your Account...
                                        </>
                                    ) : isClaimed ? (
                                        <>
                                            <Check className="w-5 h-5" />
                                            Credits Claimed!
                                        </>
                                    ) : (
                                        <>
                                            <span>Claim 10 Free Credits Now</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
