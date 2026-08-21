"use client";

import React from "react";
import { motion } from "framer-motion";
import { Currency, saveCurrency } from "@/lib/currency";
import { Globe } from "lucide-react";

interface CurrencyToggleProps {
    currency: Currency;
    onChange: (currency: Currency) => void;
    className?: string;
    showLabel?: boolean;
}

export default function CurrencyToggle({
    currency,
    onChange,
    className = "",
    showLabel = true,
}: CurrencyToggleProps) {
    const handleSelect = (c: Currency) => {
        if (c !== currency) {
            onChange(c);
            saveCurrency(c);
        }
    };

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            {showLabel && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Currency:</span>
                </div>
            )}
            <div className="relative flex items-center p-1 bg-slate-100/90 border border-slate-200/80 rounded-full shadow-inner">
                <button
                    type="button"
                    onClick={() => handleSelect("INR")}
                    className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 flex items-center gap-1.5 ${
                        currency === "INR"
                            ? "text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                    {currency === "INR" && (
                        <motion.div
                            layoutId="currency-active-pill"
                            className="absolute inset-0 bg-white rounded-full shadow-sm border border-slate-200/50"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                    )}
                    <span className="relative z-10 font-mono font-extrabold text-indigo-600">₹</span>
                    <span className="relative z-10">INR</span>
                </button>

                <button
                    type="button"
                    onClick={() => handleSelect("USD")}
                    className={`relative z-10 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors duration-200 flex items-center gap-1.5 ${
                        currency === "USD"
                            ? "text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                    {currency === "USD" && (
                        <motion.div
                            layoutId="currency-active-pill"
                            className="absolute inset-0 bg-white rounded-full shadow-sm border border-slate-200/50"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                        />
                    )}
                    <span className="relative z-10 font-mono font-extrabold text-emerald-600">$</span>
                    <span className="relative z-10">USD</span>
                </button>
            </div>
        </div>
    );
}
