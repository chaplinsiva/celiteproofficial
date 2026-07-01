"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
    ArrowLeft, Settings, Shield, Loader2, AlertTriangle,
    Power, PowerOff
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function AdminSettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState(
        "We're currently performing scheduled maintenance. Please check back shortly."
    );

    useEffect(() => {
        checkAdminAndLoad();
    }, []);

    const checkAdminAndLoad = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push("/login"); return; }

            const { data: adminData, error } = await supabase
                .from("admins")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (error || !adminData) {
                toast.error("Access denied. Admin only.");
                router.push("/dashboard");
                return;
            }

            setIsAdmin(true);
            await loadSettings();
        } catch (err) {
            console.error(err);
            router.push("/dashboard");
        }
    };

    const loadSettings = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch("/api/admin/settings", {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const data = await res.json();

            if (data.settings) {
                setMaintenanceMode(data.settings.maintenance_mode ?? false);
                setMaintenanceMessage(
                    data.settings.maintenance_message ||
                    "We're currently performing scheduled maintenance. Please check back shortly."
                );
            }
        } catch (err) {
            console.error("Failed to load settings:", err);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { toast.error("Session expired"); return; }

            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    maintenance_mode: maintenanceMode,
                    maintenance_message: maintenanceMessage,
                }),
            });

            if (!res.ok) throw new Error("Failed to save");

            toast.success("Settings saved successfully");
        } catch (err) {
            console.error(err);
            toast.error("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    const toggleMaintenance = async (newVal: boolean) => {
        setMaintenanceMode(newVal);
        // Auto-save on toggle for immediate effect
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch("/api/admin/settings", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    maintenance_mode: newVal,
                    maintenance_message: maintenanceMessage,
                }),
            });

            if (!res.ok) throw new Error("Failed");

            toast.success(
                newVal ? "🔒 Maintenance mode ON — site is now locked" : "🔓 Maintenance mode OFF — site is live"
            );
        } catch {
            toast.error("Failed to toggle maintenance mode");
            setMaintenanceMode(!newVal); // revert on failure
        } finally {
            setSaving(false);
        }
    };

    if (loading || !isAdmin) {
        return (
            <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#0A0A0B] text-gray-300">
            {/* Header */}
            <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin" className="text-gray-500 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-amber-400" />
                            <h1 className="text-xl font-bold text-white">Platform Settings</h1>
                        </div>
                    </div>

                    <button
                        onClick={saveSettings}
                        disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Shield className="w-4 h-4" />
                        )}
                        Save Settings
                    </button>
                </div>
            </header>

            <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
                {/* Maintenance Mode Card */}
                <div className={`p-6 rounded-2xl border transition-all duration-500 ${
                    maintenanceMode
                        ? "bg-red-500/[0.04] border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.05)]"
                        : "bg-white/[0.02] border-white/5"
                }`}>
                    <div className="flex items-start justify-between gap-6 mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                                <AlertTriangle className={`w-5 h-5 ${maintenanceMode ? "text-red-400" : "text-amber-400"}`} />
                                Maintenance Mode
                            </h3>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                When enabled, all non-admin users will see a maintenance page.
                                Admin users can still access the entire site normally.
                            </p>
                        </div>

                        {/* Big Toggle */}
                        <button
                            type="button"
                            onClick={() => toggleMaintenance(!maintenanceMode)}
                            disabled={saving}
                            className={`relative shrink-0 inline-flex h-10 w-[72px] items-center rounded-full transition-all duration-300 ${
                                maintenanceMode
                                    ? "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                                    : "bg-white/10 hover:bg-white/15"
                            } disabled:opacity-50`}
                        >
                            <span className={`inline-flex items-center justify-center h-8 w-8 transform rounded-full bg-white shadow-lg transition-all duration-300 ${
                                maintenanceMode ? "translate-x-9" : "translate-x-1"
                            }`}>
                                {maintenanceMode
                                    ? <PowerOff className="w-4 h-4 text-red-500" />
                                    : <Power className="w-4 h-4 text-gray-400" />
                                }
                            </span>
                        </button>
                    </div>

                    {/* Status Indicator */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6 ${
                        maintenanceMode
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${maintenanceMode ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                        {maintenanceMode ? "Site is locked — users blocked" : "Site is live — all users can access"}
                    </div>

                    {/* Maintenance Message */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
                            Message Shown to Users
                        </label>
                        <textarea
                            value={maintenanceMessage}
                            onChange={(e) => setMaintenanceMessage(e.target.value)}
                            rows={3}
                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-1 focus:ring-indigo-500/50 focus:outline-none resize-none text-sm"
                            placeholder="Enter the message users will see during maintenance..."
                        />
                        <p className="text-[10px] text-gray-600 mt-1.5">
                            This message appears on the maintenance page. Save after editing to update.
                        </p>
                    </div>
                </div>

                {/* Info Card */}
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <h4 className="text-sm font-bold text-white mb-3">How it works</h4>
                    <ul className="space-y-2 text-sm text-gray-500">
                        <li className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            <span>When ON, all pages except <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">/admin</code>, <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">/login</code>, and API routes show the maintenance page.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>Admin users (listed in the <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">admins</code> table) bypass maintenance and access everything normally.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>The toggle takes effect <strong className="text-white">immediately</strong> — no deploy or restart needed.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </main>
    );
}
