"use client";

import React, { useEffect, useState } from "react";
import { Video, Menu, X, LogOut, User } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { User as SupabaseUser } from "@supabase/supabase-js";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);

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

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-4">
        <nav className="flex items-center justify-between bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              CelitePro
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Home</Link>
            <Link href="/templates" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Templates</Link>
            {user && (
              <Link href="/dashboard" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">My Dashboard</Link>
            )}
            <Link href="#" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</Link>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-gray-300 max-w-[150px] truncate">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-white px-4 py-2 hover:text-indigo-400 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-400 hover:text-white">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden mx-4 mt-2 p-4 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl"
        >
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-gray-400 hover:text-white text-sm" onClick={() => setIsOpen(false)}>Home</Link>
            <Link href="/templates" className="text-gray-400 hover:text-white text-sm" onClick={() => setIsOpen(false)}>Templates</Link>
            {user && (
              <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm font-bold" onClick={() => setIsOpen(false)}>
                My Dashboard
              </Link>
            )}
            <Link href="#" className="text-gray-400 hover:text-white text-sm" onClick={() => setIsOpen(false)}>Pricing</Link>
            <hr className="border-white/10" />
            {user ? (
              <>
                <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm text-gray-300">
                    {user.user_metadata?.full_name || user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-400 px-4 pt-2 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-white text-sm px-4">Log in</Link>
                <Link href="/signup" className="bg-indigo-600 text-white px-4 py-3 rounded-xl font-semibold text-sm text-center">Get Started</Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </header>
  );
};

export default Header;
