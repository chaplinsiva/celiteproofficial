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

    const fetchCredits = () => {
      fetch(`/api/subscription/status?userId=${user.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.hasSubscription && data.subscription) {
            setCredits(data.subscription.rendersRemaining);
          } else if (data.isFreeUser) {
            setCredits(0);
          }
        })
        .catch((err) => console.error("Error fetching credits:", err));
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
        <nav className="flex items-center justify-between bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="CelitePro Logo"
              className="w-10 h-10 object-contain"
            />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              CelitePro
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Home</Link>
            <Link href="/about" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Our Story</Link>
            <Link href="/templates" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Templates</Link>
            <Link href="/pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {user && (
              <Link href="/pricing" className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-sm font-bold text-indigo-400 hover:bg-indigo-500/20 transition-all">
                <Zap className="w-4 h-4" />
                {credits !== null ? `${credits} Credits` : '...'}
              </Link>
            )}
            {user && (
              <Notifications userId={user.id} />
            )}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
                >
                  <div className="w-6 h-6 bg-indigo-600/20 rounded-full flex items-center justify-center overflow-hidden">
                    {user.user_metadata?.avatar_url ? (
                      <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-3 h-3 text-indigo-400" />
                    )}
                  </div>
                  <span className="text-sm text-gray-300 max-w-[150px] truncate">
                    {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                  <motion.div
                    animate={{ rotate: isUserMenuOpen ? 180 : 0 }}
                    className="text-gray-500 group-hover:text-white transition-colors"
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
                      className="absolute right-0 mt-3 w-56 p-2 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl origin-top-right z-[60]"
                    >
                      <Link
                        href="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                      >
                        <User className="w-4 h-4" />
                        My Dashboard
                      </Link>
                      <hr className="border-white/5 my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/5 rounded-xl transition-all"
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
                  className="text-sm font-medium text-white px-4 py-2 hover:text-indigo-400 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href={`/signup?redirect=${encodeURIComponent(pathname)}`}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
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
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-400 hover:text-white">
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
            className="md:hidden mx-4 mt-2 p-4 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl z-50 overflow-hidden shadow-2xl"
          >
            <div className="flex flex-col gap-2">
              <Link href="/" className="text-gray-400 hover:text-white text-sm px-4 py-3 hover:bg-white/5 rounded-xl transition-all" onClick={() => setIsOpen(false)}>Home</Link>
              <Link href="/about" className="text-gray-400 hover:text-white text-sm px-4 py-3 hover:bg-white/5 rounded-xl transition-all" onClick={() => setIsOpen(false)}>Our Story</Link>
              <Link href="/templates" className="text-gray-400 hover:text-white text-sm px-4 py-3 hover:bg-white/5 rounded-xl transition-all" onClick={() => setIsOpen(false)}>Templates</Link>
              <Link href="/pricing" className="text-gray-400 hover:text-white text-sm px-4 py-3 hover:bg-white/5 rounded-xl transition-all" onClick={() => setIsOpen(false)}>Pricing</Link>

              {user ? (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                  <div className="px-4 py-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600/20 rounded-full flex items-center justify-center overflow-hidden">
                      {user.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Signed in as</div>
                      <div className="text-sm text-white font-medium truncate">{user.email}</div>
                    </div>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-4 text-sm text-indigo-400 font-bold hover:bg-indigo-600/5 rounded-xl transition-all"
                  >
                    <User className="w-4 h-4" />
                    My Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-4 text-sm text-red-400 hover:bg-red-400/5 rounded-xl transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 gap-3">
                  <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="flex items-center justify-center py-3 text-white text-sm font-semibold rounded-xl border border-white/5 hover:bg-white/5" onClick={() => setIsOpen(false)}>Log in</Link>
                  <Link href={`/signup?redirect=${encodeURIComponent(pathname)}`} className="flex items-center justify-center bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-xl" onClick={() => setIsOpen(false)}>Join Now</Link>
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
