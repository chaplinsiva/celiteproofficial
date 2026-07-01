"use client";

import React, { useEffect, useState } from "react";
import { Video, Menu, X, LogOut, User, Bell, Zap } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Notifications from "./Notifications";
import { usePathname } from "next/navigation";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCredits(null);
      return;
    }

    const fetchCredits = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/subscription/status`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (res.ok) {
          if (data.hasSubscription && data.subscription) {
            // Active (non-expired) subscription — show remaining credits
            const rem = data.subscription.rendersRemaining;
            setCredits(rem === null ? -1 : rem); // -1 = unlimited
          } else if (data.hasExpiredCredits && data.expiredCredits) {
            // Expired subscription with remaining credits — still show them
            const rem = data.expiredCredits.remaining;
            setCredits(rem >= 9999 ? -1 : rem); // 9999 sentinel = unlimited
          } else {
            // Pure free user — hide the credits chip entirely
            setCredits(null);
          }
        }
      } catch (err) {
        console.error("Error fetching credits:", err);
      }
    };

    // Initial fetch
    fetchCredits();

    // Re-fetch when window gets focus (so it updates after returning from checkout/admin)
    window.addEventListener("focus", fetchCredits);
    return () => {
      window.removeEventListener("focus", fetchCredits);
    };
  }, [user]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIsUserMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
        <nav className="flex items-center justify-between bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-[0_4px_30px_rgba(0,0,0,0.03)] rounded-2xl px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="CelitePro Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500">
              CelitePro
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Home</Link>
            <Link href="/about" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Our Story</Link>
            <Link href="/templates" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Templates</Link>
            <Link href="/pricing" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Pricing</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {user && credits !== null && (
              <Link href="/dashboard" className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-100 transition-all">
                <Zap className="w-4 h-4" />
                {credits === -1 ? '∞ Credits' : `${credits} Credits`}
              </Link>
            )}
            {user && (
              <Notifications userId={user.id} />
            )}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-slate-100 transition-all group"
                >
                  <div className="w-6 h-6 bg-blue-600/10 rounded-full flex items-center justify-center overflow-hidden">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3 h-3 text-blue-600" />
                    )}
                  </div>
                  <span className="text-sm text-slate-700 max-w-[150px] truncate font-medium">
                    {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                  <motion.div
                    animate={{ rotate: isUserMenuOpen ? 180 : 0 }}
                    className="text-slate-400 group-hover:text-slate-800 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-56 p-2 bg-white backdrop-blur-2xl border border-slate-200/80 rounded-2xl shadow-xl origin-top-right z-[60]"
                    >
                      <Link
                        href="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all font-medium"
                      >
                        <User className="w-4 h-4" />
                        My Dashboard
                      </Link>
                      <hr className="border-slate-100 my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname)}`}
                  className="text-sm font-medium text-slate-600 px-4 py-2 hover:text-blue-600 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href={`/signup?redirect=${encodeURIComponent(pathname)}`}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="flex md:hidden items-center gap-2">
            {user && (
              <Notifications userId={user.id} />
            )}
            <button onClick={() => setIsOpen(!isOpen)} className="text-slate-600 hover:text-slate-900">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            className="md:hidden mx-4 mt-2 p-4 bg-white backdrop-blur-2xl border border-slate-200 rounded-2xl z-50 overflow-hidden shadow-xl"
          >
            <div className="flex flex-col gap-2">
              <Link href="/" className="text-slate-600 hover:text-slate-900 text-sm px-4 py-3 hover:bg-slate-50 rounded-xl transition-all font-medium" onClick={() => setIsOpen(false)}>Home</Link>
              <Link href="/about" className="text-slate-600 hover:text-slate-900 text-sm px-4 py-3 hover:bg-slate-50 rounded-xl transition-all font-medium" onClick={() => setIsOpen(false)}>Our Story</Link>
              <Link href="/templates" className="text-slate-600 hover:text-slate-900 text-sm px-4 py-3 hover:bg-slate-50 rounded-xl transition-all font-medium" onClick={() => setIsOpen(false)}>Templates</Link>
              <Link href="/pricing" className="text-slate-600 hover:text-slate-900 text-sm px-4 py-3 hover:bg-slate-50 rounded-xl transition-all font-medium" onClick={() => setIsOpen(false)}>Pricing</Link>

              {user ? (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                  <div className="px-4 py-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600/10 rounded-full flex items-center justify-center overflow-hidden">
                      {user.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Signed in as</div>
                      <div className="text-sm text-slate-800 font-semibold truncate max-w-[180px]">{user.email}</div>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-4 text-sm text-blue-600 font-bold hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <User className="w-4 h-4" />
                    My Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-4 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all font-semibold"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                  <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="flex items-center justify-center py-3 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 hover:bg-slate-50" onClick={() => setIsOpen(false)}>Log in</Link>
                  <Link href={`/signup?redirect=${encodeURIComponent(pathname)}`} className="flex items-center justify-center bg-blue-600 text-white py-3 rounded-xl font-bold text-sm shadow-sm" onClick={() => setIsOpen(false)}>Join Now</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
