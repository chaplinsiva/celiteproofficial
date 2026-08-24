// agent-notes: { ctx: "Dynamic funny/happy random GIF and meme card for checkout page", deps: ["framer-motion", "lucide-react"], state: active, last: "sato@2026-08-24" }
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, Smile, Heart, Flame } from "lucide-react";

export interface FunnyVibeItem {
    id: string;
    title: string;
    caption: string;
    gifUrl: string;
    emoji: string;
    badge: string;
}

export const FUNNY_CHECKOUT_VIBES: FunnyVibeItem[] = [
    {
        id: "shut-up-money",
        title: "Shut up & take my credits!",
        caption: "Your wedding invitation videos are about to look like a blockbuster movie 🎬",
        gifUrl: "https://media.giphy.com/media/sDcfxFDozb3bO/giphy.gif",
        emoji: "💸",
        badge: "Pure Hype"
    },
    {
        id: "dicaprio-cheers",
        title: "Cheers to Great Taste!",
        caption: "You just leveled up your creative game. Leonardo approves 🥂",
        gifUrl: "https://media.giphy.com/media/GCLlQnV7sjqAg0uRlj/giphy.gif",
        emoji: "🥂",
        badge: "VIP Club"
    },
    {
        id: "happy-cat",
        title: "Vibing to 60fps HD Renders",
        caption: "Zero watermarks, ultra crisp 4K quality, and happy clients guaranteed 🐱✨",
        gifUrl: "https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif",
        emoji: "🕺",
        badge: "Good Vibes"
    },
    {
        id: "carlton-dance",
        title: "That Fresh Subscription Feeling!",
        caption: "When the render finishes in seconds and you didn't have to open After Effects 🎉",
        gifUrl: "https://media.giphy.com/media/pa37AAGzKXoek/giphy.gif",
        emoji: "💃",
        badge: "Dance Break"
    },
    {
        id: "success-kid",
        title: "Wedding Video Maker: Upgraded!",
        caption: "Instant GPU cloud rendering unlocked. Your wallet and clients thank you 🏆",
        gifUrl: "https://media.giphy.com/media/nXxOjZrbnbRxS/giphy.gif",
        emoji: "🔥",
        badge: "Winner Energy"
    },
    {
        id: "mind-blown",
        title: "Wait, it's that fast?!",
        caption: "Automated dynamic layer replacement in the cloud while you relax 🤯",
        gifUrl: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
        emoji: "🚀",
        badge: "Next Gen"
    },
    {
        id: "dog-cool",
        title: "Cool Creators Club",
        caption: "Unlimited previews, priority render queues, and pure swag 😎",
        gifUrl: "https://media.giphy.com/media/13CoXDiaCcCoyk/giphy.gif",
        emoji: "😎",
        badge: "Legendary"
    },
    {
        id: "baby-dance",
        title: "Happy Dance Activated!",
        caption: "One click render, instant MP4 download, stress-free weddings 👶✨",
        gifUrl: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
        emoji: "🥳",
        badge: "Happy Mood"
    },
    {
        id: "steve-carell-happening",
        title: "OMG, It's Happening!",
        caption: "Unlocking unlimited full-resolution HD exports right now 🤩",
        gifUrl: "https://media.giphy.com/media/huJmPXfeir5JlpPAx0/giphy.gif",
        emoji: "🤩",
        badge: "Super Hype"
    },
    {
        id: "spongebob-rainbow",
        title: "Pure Creative Magic",
        caption: "Every invitation template personalized and rendered flawlessly 🌈",
        gifUrl: "https://media.giphy.com/media/SKGo6OYe24EBG/giphy.gif",
        emoji: "🌈",
        badge: "Magical"
    },
    {
        id: "kermit-fast",
        title: "Speed Level: 9000",
        caption: "Cloud rendering pipelines ready to take flight 🐸🚀",
        gifUrl: "https://media.giphy.com/media/XIqCQx028ItdX7RCtH/giphy.gif",
        emoji: "🐸",
        badge: "Turbo"
    },
    {
        id: "minions-party",
        title: "VIP Member Welcome",
        caption: "All wedding templates unlocked with zero rendering wait times 🍌🎉",
        gifUrl: "https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif",
        emoji: "🍌",
        badge: "Party Time"
    },
    {
        id: "bob-ross-happy",
        title: "Happy Little Creations",
        caption: "Making couples smile with breathtaking animated invitations 🎨",
        gifUrl: "https://media.giphy.com/media/rYEAkYihZURGM/giphy.gif",
        emoji: "🎨",
        badge: "Masterpiece"
    },
    {
        id: "homer-dance",
        title: "No More Rendering Headaches",
        caption: "Goodbye complex software, hello automated instant cloud exports 🍩",
        gifUrl: "https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif",
        emoji: "🍩",
        badge: "Sweet Deal"
    },
    {
        id: "confetti-grand",
        title: "Celebration Mode!",
        caption: "Your video editing workflow just got 10x faster 🎊",
        gifUrl: "https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif",
        emoji: "🎊",
        badge: "Winner"
    },
    {
        id: "dj-groove",
        title: "Drop the Soundtrack",
        caption: "Crystal clear audio synchronization on every single render 🎧",
        gifUrl: "https://media.giphy.com/media/l41lI4bYmcsPJX9Go/giphy.gif",
        emoji: "🎧",
        badge: "Audio Pro"
    },
    {
        id: "matrix-hack",
        title: "Cloud Engine Power",
        caption: "Dedicated GPU render servers handling your workload 🕶️",
        gifUrl: "https://media.giphy.com/media/eIm624c8nnNbiG0V3g/giphy.gif",
        emoji: "🕶️",
        badge: "High Tech"
    },
    {
        id: "high-five-team",
        title: "High Fives All Around",
        caption: "Your smart investment in effortless video creation ✋",
        gifUrl: "https://media.giphy.com/media/l0ErFafpUCQTQFMSk/giphy.gif",
        emoji: "✋",
        badge: "Top Choice"
    },
    {
        id: "excited-cheer",
        title: "Best Decision Today!",
        caption: "Stunning video invites delivered to your clients on time, every time 👏",
        gifUrl: "https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif",
        emoji: "👏",
        badge: "Excited"
    },
    {
        id: "ron-swanson-win",
        title: "Certified Creator",
        caption: "Work smarter, render in cloud, enjoy the compliments 🕺",
        gifUrl: "https://media.giphy.com/media/eP0rqVQCH063e/giphy.gif",
        emoji: "🕺",
        badge: "Pro Level"
    },
    {
        id: "wizard-sparks",
        title: "Pure Enchantment",
        caption: "Transforming photos into golden cinematic wedding memories 🪄",
        gifUrl: "https://media.giphy.com/media/12NUbkX6p4VNei/giphy.gif",
        emoji: "🪄",
        badge: "Enchanted"
    },
    {
        id: "fireworks-show",
        title: "Spectacular Results",
        caption: "HD resolutions that sparkle on smartphones and 4K TVs alike 🎆",
        gifUrl: "https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif",
        emoji: "🎆",
        badge: "Spectacular"
    },
    {
        id: "panda-happy-roll",
        title: "Zero Stress Editing",
        caption: "Smooth, automated and relaxing cloud rendering experience 🐼",
        gifUrl: "https://media.giphy.com/media/EatwJZRUIv41G/giphy.gif",
        emoji: "🐼",
        badge: "Chill Vibes"
    },
    {
        id: "rocket-orbit",
        title: "Skyrocketing Efficiency",
        caption: "Deliver multiple customized client videos in minutes 🚀",
        gifUrl: "https://media.giphy.com/media/mi6DsSSNKDbUY/giphy.gif",
        emoji: "🚀",
        badge: "Fast Track"
    },
    {
        id: "chef-kiss",
        title: "Chef's Kiss Quality",
        caption: "Flawless typography, transitions, and image composition 👨‍🍳",
        gifUrl: "https://media.giphy.com/media/l4Jz3a8jO92crUlWM/giphy.gif",
        emoji: "👨‍🍳",
        badge: "5-Star"
    },
    {
        id: "popcorn-snack",
        title: "Sit Back & Relax",
        caption: "Grab a snack while CelitePro generates your video automatically 🍿",
        gifUrl: "https://media.giphy.com/media/t3sZxY5zS5B0z5zMIz/giphy.gif",
        emoji: "🍿",
        badge: "Relaxing"
    },
    {
        id: "cat-code",
        title: "AI Powering Every Frame",
        caption: "Intelligent background removals and image positioning in cloud 🐱",
        gifUrl: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
        emoji: "🐱",
        badge: "AI Powered"
    },
    {
        id: "coffee-boost",
        title: "Creative Energy",
        caption: "Power up your wedding business with fresh video invitations ☕",
        gifUrl: "https://media.giphy.com/media/3o7TKTDnUxE0gpn344/giphy.gif",
        emoji: "☕",
        badge: "Energized"
    },
    {
        id: "duck-strut",
        title: "Strut with Confidence",
        caption: "Your clients are going to be blown away by the quality 🦆",
        gifUrl: "https://media.giphy.com/media/krewXUB6LBja/giphy.gif",
        emoji: "🦆",
        badge: "Confident"
    },
    {
        id: "pixel-win",
        title: "Level Up Complete!",
        caption: "Welcome to the ultimate SaaS video rendering platform 🕹️",
        gifUrl: "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif",
        emoji: "🕹️",
        badge: "Level Up"
    },
    {
        id: "cyber-future",
        title: "Future of Invitations",
        caption: "Next generation digital video invitations made effortless 🌐",
        gifUrl: "https://media.giphy.com/media/3o7btQ8jDTPGDpgc6I/giphy.gif",
        emoji: "🌐",
        badge: "Next Gen"
    }
];

export const PROCESSING_VIBE: FunnyVibeItem = {
    id: "processing-hype",
    title: "Securing your VIP pass...",
    caption: "Hold tight! Our GPU servers are warming up your render superpowers ⚡",
    gifUrl: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif",
    emoji: "⚡",
    badge: "Activating..."
};

export default function CheckoutFunnyVibes({ isProcessing = false }: { isProcessing?: boolean }) {
    const [currentVibeIndex, setCurrentVibeIndex] = useState<number>(0);
    const [isRolling, setIsRolling] = useState(false);

    // Pick a random vibe on initial mount
    useEffect(() => {
        const randomIndex = Math.floor(Math.random() * FUNNY_CHECKOUT_VIBES.length);
        setCurrentVibeIndex(randomIndex);
    }, []);

    const handleNextVibe = () => {
        setIsRolling(true);
        setTimeout(() => {
            setCurrentVibeIndex(prev => (prev + 1) % FUNNY_CHECKOUT_VIBES.length);
            setIsRolling(false);
        }, 150);
    };

    const currentVibe = isProcessing ? PROCESSING_VIBE : FUNNY_CHECKOUT_VIBES[currentVibeIndex] || FUNNY_CHECKOUT_VIBES[0];

    return (
        <div className="w-full mb-6 flex justify-center select-none">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentVibe.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="relative w-40 h-28 sm:w-56 sm:h-36 max-w-[85vw] rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-slate-100 group"
                >
                    <img
                        src={currentVibe.gifUrl}
                        alt="Checkout Vibe"
                        className="w-full h-full object-cover"
                        loading="eager"
                    />
                    {/* Floating Refresh Button directly on the GIF */}
                    {!isProcessing && (
                        <button
                            type="button"
                            onClick={handleNextVibe}
                            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 p-1.5 sm:p-2 rounded-full bg-black/60 hover:bg-black/85 text-white/90 hover:text-white backdrop-blur-md transition-all shadow-md active:scale-90 border border-white/20 cursor-pointer touch-manipulation"
                            title="Random GIF"
                            aria-label="Switch random meme GIF"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRolling ? "animate-spin" : ""}`} />
                        </button>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
