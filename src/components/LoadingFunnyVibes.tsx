// agent-notes: { ctx: "Compact funny loading & render progress GIF component with switch button", deps: ["framer-motion", "lucide-react"], state: active, last: "sato@2026-08-24" }
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Sparkles } from "lucide-react";

export interface LoadingVibeItem {
    id: string;
    title: string;
    caption: string;
    gifUrl: string;
    emoji: string;
}

export const LOADING_FUNNY_VIBES: LoadingVibeItem[] = [
    {
        id: "popcorn-time",
        title: "Popcorn time!",
        caption: "Baking fresh 60fps video frames in the cloud 🍿",
        gifUrl: "https://media.giphy.com/media/t3sZxY5zS5B0z5zMIz/giphy.gif",
        emoji: "🍿"
    },
    {
        id: "cat-typing",
        title: "Turbo rendering...",
        caption: "Our cloud AI is typing & compositing at 9000 WPM 🐱💻",
        gifUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
        emoji: "🐱"
    },
    {
        id: "chef-cooking",
        title: "Cooking a Masterpiece",
        caption: "Seasoning your photos with cinematic gold & sparkles ✨",
        gifUrl: "https://media.giphy.com/media/l4Jz3a8jO92crUlWM/giphy.gif",
        emoji: "👨‍🍳"
    },
    {
        id: "hamster-gpu",
        title: "GPU Turbo-Boost",
        caption: "Rendering engine running at maximum horsepower 🐹💨",
        gifUrl: "https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
        emoji: "⚡"
    },
    {
        id: "waiting-mr-bean",
        title: "Almost there!",
        caption: "Great wedding invitations are worth the few seconds ⏱️",
        gifUrl: "https://media.giphy.com/media/pFZTlrO0MV6LoWSDXd/giphy.gif",
        emoji: "👀"
    },
    {
        id: "coffee-loading",
        title: "Brewing Pixels",
        caption: "Blending dynamic layers, typography, and audio tracks ☕",
        gifUrl: "https://media.giphy.com/media/3o7TKTDnUxE0gpn344/giphy.gif",
        emoji: "☕"
    },
    {
        id: "kermit-typing",
        title: "High-Speed Encoding",
        caption: "Kermit is personally hand-crafting your video timeline 🐸🔥",
        gifUrl: "https://media.giphy.com/media/XIqCQx028ItdX7RCtH/giphy.gif",
        emoji: "🐸"
    },
    {
        id: "spongebob-magic",
        title: "Adding Pure Magic",
        caption: "Sprinkling rainbow sparkle transitions across every scene 🌈✨",
        gifUrl: "https://media.giphy.com/media/SKGo6OYe24EBG/giphy.gif",
        emoji: "🌈"
    },
    {
        id: "rocket-launch",
        title: "Cloud Lift-Off!",
        caption: "Exporting crystal clear 1080p MP4 to high-speed CDN 🚀",
        gifUrl: "https://media.giphy.com/media/mi6DsSSNKDbUY/giphy.gif",
        emoji: "🚀"
    },
    {
        id: "steve-carell-happening",
        title: "OMG, It's Happening!",
        caption: "Final composite pass is rendering right now 🎉",
        gifUrl: "https://media.giphy.com/media/huJmPXfeir5JlpPAx0/giphy.gif",
        emoji: "🤩"
    },
    {
        id: "minions-cheering",
        title: "The Render Minions",
        caption: "Cheering for your video as it reaches the final second 🍌",
        gifUrl: "https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif",
        emoji: "🎉"
    },
    {
        id: "dog-nodding",
        title: "Quality Check Approved",
        caption: "Nodding along to the soundtrack beat 🐶🎵",
        gifUrl: "https://media.giphy.com/media/mCRJDo24UvJMA/giphy.gif",
        emoji: "🐶"
    },
    {
        id: "bob-ross-trees",
        title: "Happy Little Pixels",
        caption: "Painting happy little memories on your wedding video 🎨",
        gifUrl: "https://media.giphy.com/media/rYEAkYihZURGM/giphy.gif",
        emoji: "🎨"
    },
    {
        id: "homer-spinning",
        title: "Pure Cloud Excitement",
        caption: "Spinning around in circles because it looks so good 🍩",
        gifUrl: "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif",
        emoji: "🍩"
    },
    {
        id: "matrix-rain",
        title: "Matrix GPU Rendering",
        caption: "Decoding neon green visual magic at 100 FPS 🕶️",
        gifUrl: "https://media.giphy.com/media/eIm624c8nnNbiG0V3g/giphy.gif",
        emoji: "🕶️"
    },
    {
        id: "excited-girl",
        title: "So Excited!",
        caption: "Your clients and family are going to love this invitation 👏",
        gifUrl: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif",
        emoji: "👏"
    },
    {
        id: "ron-swanson-dance",
        title: "Victory Groove",
        caption: "When the render queue clears in record time 🕺",
        gifUrl: "https://media.giphy.com/media/eP0rqVQCH063e/giphy.gif",
        emoji: "🕺"
    },
    {
        id: "cat-bobbing",
        title: "Audio Sync Perfection",
        caption: "Syncing the background music drop with your photo reveal 🎧",
        gifUrl: "https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif",
        emoji: "🎧"
    },
    {
        id: "wizard-magic",
        title: "Magical Enchantment",
        caption: "Casting spells to eliminate all compression artifacts 🧙‍♂️🪄",
        gifUrl: "https://media.giphy.com/media/12NUbkX6p4VNei/giphy.gif",
        emoji: "🧙‍♂️"
    },
    {
        id: "confetti-blast",
        title: "Almost Show Time!",
        caption: "Loading the confetti cannon for the grand download reveal 🎊",
        gifUrl: "https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif",
        emoji: "🎊"
    },
    {
        id: "high-five",
        title: "High Five Teamwork!",
        caption: "You customized it, our cloud renders it seamlessly ✋",
        gifUrl: "https://media.giphy.com/media/l0ErFafpUCQTQFMSk/giphy.gif",
        emoji: "✋"
    },
    {
        id: "dj-spinning",
        title: "Drop the Bass!",
        caption: "Mastering 320kbps pristine stereo audio for the preview 🎶",
        gifUrl: "https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif",
        emoji: "🎶"
    },
    {
        id: "pixel-game-bar",
        title: "8-Bit Super Speed",
        caption: "Collecting power-up stars for ultra-fast GPU processing 🕹️",
        gifUrl: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
        emoji: "🕹️"
    },
    {
        id: "cyberpunk-grid",
        title: "Next-Gen Engine",
        caption: "Harnessing futuristic server arrays for instant exports 🌐",
        gifUrl: "https://media.giphy.com/media/3o7btQ8jDTPGDpgc6I/giphy.gif",
        emoji: "🌐"
    },
    {
        id: "duck-waddle",
        title: "Waddling to the Finish Line",
        caption: "Just a few more frames waddling into place 🦆",
        gifUrl: "https://media.giphy.com/media/krewXUB6LBja/giphy.gif",
        emoji: "🦆"
    },
    {
        id: "fireworks-finale",
        title: "Grand Finale Loading",
        caption: "Lighting up the digital sky with vibrant colors 🎆",
        gifUrl: "https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif",
        emoji: "🎆"
    },
    {
        id: "panda-rolling",
        title: "Rolling in Happiness",
        caption: "Panda approved smoothness and zero video lag 🐼",
        gifUrl: "https://media.giphy.com/media/EatwJZRUIv41G/giphy.gif",
        emoji: "🐼"
    },
    {
        id: "carlton-groove",
        title: "Carlton Celebration",
        caption: "Dancing while the server does all the heavy lifting 💃",
        gifUrl: "https://media.giphy.com/media/pa37AAGzKXoek/giphy.gif",
        emoji: "💃"
    },
    {
        id: "success-baby",
        title: "Winning Every Second",
        caption: "Your video render is turning out 100% flawless 👶🔥",
        gifUrl: "https://media.giphy.com/media/nXxOjZrbnbRxS/giphy.gif",
        emoji: "🔥"
    },
    {
        id: "dicaprio-cheer",
        title: "Cheers to Great Creations",
        caption: "Leonardo raising a glass to your stunning video 🥂",
        gifUrl: "https://media.giphy.com/media/GCLlQnV7sjqAg0uRlj/giphy.gif",
        emoji: "🥂"
    },
    {
        id: "happy-cat-vibe",
        title: "Cat Head Bobbing",
        caption: "Feeling the wedding invitation vibe on repeat 🐱💖",
        gifUrl: "https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif",
        emoji: "🐱"
    },
    {
        id: "mind-blown-galaxy",
        title: "Mind = Blown",
        caption: "The final resolution will blow your viewers away 🌌",
        gifUrl: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
        emoji: "🌌"
    },
    {
        id: "money-gun",
        title: "Making It Rain Value",
        caption: "Pro studio quality invitation at a fraction of the cost 💸",
        gifUrl: "https://media.giphy.com/media/sDcfxFDozb3bO/giphy.gif",
        emoji: "💸"
    },
    {
        id: "dog-cool-shades",
        title: "Too Cool for School",
        caption: "Looking ultra sleek with crisp 4K typography 😎",
        gifUrl: "https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
        emoji: "😎"
    },
    {
        id: "baby-dance-happy",
        title: "Baby Groove",
        caption: "Nothing but pure joy coming your way in 3.. 2.. 1.. 🥳",
        gifUrl: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
        emoji: "🥳"
    }
];

interface LoadingFunnyVibesProps {
    variant?: "compact" | "standard";
    className?: string;
}

export default function LoadingFunnyVibes({ variant = "compact", className = "" }: LoadingFunnyVibesProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);

    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * LOADING_FUNNY_VIBES.length);
        setCurrentIndex(randomIndex);
    }, []);

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSpinning(true);
        setTimeout(() => {
            setCurrentIndex(prev => (prev + 1) % LOADING_FUNNY_VIBES.length);
            setIsSpinning(false);
        }, 120);
    };

    const currentVibe = LOADING_FUNNY_VIBES[currentIndex] || LOADING_FUNNY_VIBES[0];

    if (variant === "compact") {
        return (
            <div className={`relative mx-auto my-2 select-none ${className}`}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentVibe.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-28 h-20 sm:w-36 sm:h-28 max-w-[75vw] mx-auto rounded-2xl overflow-hidden shadow-xl border border-white/20 bg-slate-900 group"
                    >
                        <img
                            src={currentVibe.gifUrl}
                            alt="Loading"
                            className="w-full h-full object-cover"
                        />
                        {/* Floating Refresh Button directly on the GIF */}
                        <button
                            type="button"
                            onClick={handleNext}
                            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1.5 sm:p-2 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white backdrop-blur-md transition-all shadow-md active:scale-90 border border-white/20 cursor-pointer touch-manipulation"
                            title="Random GIF"
                            aria-label="Switch random meme GIF"
                        >
                            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
                        </button>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    // Standard variant (for dedicated render page)
    return (
        <div className={`relative mx-auto my-4 sm:my-5 select-none ${className}`}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentVibe.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-44 h-32 sm:w-56 sm:h-40 max-w-[85vw] mx-auto rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-slate-100 group"
                >
                    <img
                        src={currentVibe.gifUrl}
                        alt="Rendering"
                        className="w-full h-full object-cover"
                    />
                    {/* Floating Refresh Button directly on the GIF */}
                    <button
                        type="button"
                        onClick={handleNext}
                        className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 p-2 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white backdrop-blur-md transition-all shadow-md active:scale-90 border border-white/20 cursor-pointer touch-manipulation"
                        title="Random GIF"
                        aria-label="Switch random meme GIF"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isSpinning ? "animate-spin" : ""}`} />
                    </button>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
