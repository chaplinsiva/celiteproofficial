"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
    const [message, setMessage] = useState(
        "We're currently performing scheduled maintenance. Please check back shortly."
    );

    useEffect(() => {
        // Fetch the custom message from the API
        fetch("/api/admin/settings")
            .then((r) => r.json())
            .then((d) => {
                if (d.settings?.maintenance_message) {
                    setMessage(d.settings.maintenance_message);
                }
            })
            .catch(() => {});
    }, []);

    return (
        <main className="min-h-screen bg-[#0A0A0B] flex items-center justify-center px-6">
            <div className="max-w-md text-center">
                {/* Animated icon */}
                <div className="relative mx-auto w-20 h-20 mb-8">
                    <div className="absolute inset-0 rounded-full bg-amber-500/10 animate-ping" />
                    <div className="relative w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Wrench className="w-9 h-9 text-amber-400" />
                    </div>
                </div>

                <h1 className="text-3xl font-extrabold text-white mb-3">
                    Under Maintenance
                </h1>

                <p className="text-gray-400 text-sm leading-relaxed mb-8">
                    {message}
                </p>

                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/10 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs text-gray-500 font-medium">
                        We&apos;ll be back soon
                    </span>
                </div>
            </div>
        </main>
    );
}
