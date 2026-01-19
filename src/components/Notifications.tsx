"use client";

import React, { useEffect, useState, useRef } from "react";
import { Bell, Loader2, Play, CheckCircle, XCircle, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

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
            const res = await fetch(`/api/notifications?userId=${userId}`);
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
            await fetch("/api/notifications/mark-viewed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
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
                className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black">
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
                        className="absolute right-0 mt-3 w-80 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden"
                    >
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Notifications</h3>
                            {notifications.length > 0 && (
                                <button
                                    onClick={markAllViewed}
                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase"
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 flex items-center justify-center">
                                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Bell className="w-8 h-8 text-white/10 mx-auto mb-3" />
                                    <p className="text-sm text-gray-500">No new notifications</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {notifications.map((notif) => (
                                        <Link
                                            key={notif.id}
                                            href={`/render/${notif.id}`}
                                            onClick={() => setIsOpen(false)}
                                            className="block p-4 hover:bg-white/5 transition-all group"
                                        >
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden shrink-0 border border-white/10">
                                                    {notif.template?.thumbnail_url ? (
                                                        <img
                                                            src={notif.template.thumbnail_url}
                                                            alt=""
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Play className="w-4 h-4 text-gray-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {notif.status === "completed" && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                                                        {notif.status === "failed" && <XCircle className="w-3 h-3 text-red-400" />}
                                                        {(notif.status === "processing" || notif.status === "pending") && <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />}
                                                        <span className={`text-[10px] font-bold uppercase tracking-tight ${notif.status === "completed" ? "text-emerald-400" :
                                                                notif.status === "failed" ? "text-red-400" :
                                                                    "text-indigo-400"
                                                            }`}>
                                                            {notif.status === "completed" ? "Render Ready" : notif.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-white font-medium truncate mb-1">
                                                        {notif.template?.title || "Untitled Render"}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-[9px] text-gray-500">
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
                                className="block p-4 text-center text-xs font-bold text-gray-400 hover:text-white border-t border-white/5 hover:bg-white/5 transition-all"
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
