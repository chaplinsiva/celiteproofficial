"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState, useRef } from "react";
import { Bell, Loader2, Play, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Notification {
    id: string;
    status: string;
    created_at: string;
    template?: {
        title: string;
        thumbnail_url: string;
    };
}

const Notifications = ({ userId }: { userId: string }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();
        // Polling for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [userId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const res = await fetch(`/api/notifications`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                }
            });
            const data = await res.json();
            if (data.notifications) {
                setNotifications(data.notifications);
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const markAllViewed = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            await fetch("/api/notifications/mark-viewed", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({}),
            });
            setNotifications([]);
            setIsOpen(false);
        } catch (error) {
            console.error("Error marking all viewed:", error);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-xl transition-all ${
                    isOpen 
                        ? "text-slate-800 bg-slate-100" 
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
            >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-4.5 h-4.5 bg-indigo-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                        {notifications.length}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute right-0 sm:right-0 -mr-2 sm:mr-0 mt-3 w-[calc(100vw-2rem)] sm:w-85 max-w-sm bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/40 z-[70] overflow-hidden"
                    >
                        {/* Signature Gradient Top Accent */}
                        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500" />

                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</h3>
                            {notifications.length > 0 && (
                                <button
                                    onClick={markAllViewed}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-755 hover:underline font-bold uppercase transition-all"
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-10 text-center flex flex-col items-center justify-center gap-2">
                                    <div className="p-3 bg-slate-50 rounded-full border border-slate-100">
                                        <Bell className="w-6 h-6 text-slate-300" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-800">All caught up!</p>
                                    <p className="text-[10px] text-slate-400 max-w-[150px]">No new notifications to display</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {notifications.map((notif) => (
                                        <Link
                                            key={notif.id}
                                            href={`/render/${notif.id}`}
                                            onClick={() => setIsOpen(false)}
                                            className="block p-4 hover:bg-slate-50/80 transition-all group"
                                        >
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200/50">
                                                    {notif.template?.thumbnail_url ? (
                                                        <img
                                                            src={notif.template.thumbnail_url}
                                                            alt=""
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Play className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        {notif.status === "completed" && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                                        {notif.status === "failed" && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                                                        {(notif.status === "processing" || notif.status === "pending") && <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />}
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider ${notif.status === "completed" ? "text-emerald-600" :
                                                                notif.status === "failed" ? "text-rose-600" :
                                                                    "text-indigo-600"
                                                            }`}>
                                                            {notif.status === "completed" ? "Render Ready" : notif.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-800 font-semibold truncate group-hover:text-indigo-600 transition-colors mb-0.5">
                                                        {notif.template?.title || "Untitled Render"}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(notif.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {notifications.length > 0 && (
                            <Link
                                href="/dashboard"
                                onClick={() => setIsOpen(false)}
                                className="block p-3.5 text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 border-t border-slate-100 hover:bg-slate-50/50 transition-all"
                            >
                                View full history in Dashboard
                            </Link>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Notifications;
