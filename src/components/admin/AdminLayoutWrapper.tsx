"use client";

import { useState } from "react";
import { Menu, X, User, ChevronLeft } from "lucide-react";
import { AdminNav } from "./AdminNav";
import { LanguageProvider } from "@/lib/LanguageContext";
import Link from "next/link";

export function AdminLayoutWrapper({ 
  children, 
  user 
}: { 
  children: React.ReactNode; 
  user: any;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[var(--bg-base)] overflow-hidden relative">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[var(--border-subtle)] flex items-center justify-between px-6 z-[1000] backdrop-blur-md bg-white/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center text-white font-black">A</div>
          <span className="gradient-text font-black text-xl">ActiveCAMT</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-xl bg-gray-50 text-[var(--text-primary)]"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[1001]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        sidebar fixed lg:static inset-y-0 left-0 z-[1002] 
        transition-transform duration-300 transform
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:flex
        w-[280px] bg-white border-r border-[var(--border-subtle)] flex flex-col p-6
      `}>
        <div className="flex items-center justify-between lg:justify-start mb-10">
          <Link href="/admin/dashboard" className="flex items-center gap-3 no-underline">
            <div className="w-9 h-9 bg-[var(--accent-primary)] rounded-xl flex items-center justify-center text-white font-black text-lg">A</div>
            <div className="flex flex-col">
              <span className="gradient-text font-black text-2xl tracking-tight">ActiveCAMT</span>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em] -mt-1">Admin Panel</span>
            </div>
          </Link>
          <button className="lg:hidden p-2" onClick={() => setIsSidebarOpen(false)}>
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <LanguageProvider>
            <AdminNav />
          </LanguageProvider>
        </div>

        <div className="mt-auto pt-6 border-t border-[var(--border-subtle)]">
          <div className="bg-[var(--bg-elevated)] p-4 rounded-2xl flex items-center gap-3 border border-[var(--border-subtle)]">
            {user.image ? (
              <img src={user.image} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[var(--text-secondary)] shadow-sm">
                <User size={20} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">{user.name}</p>
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`
        flex-1 overflow-y-auto p-6 lg:p-12 mt-16 lg:mt-0
        bg-[var(--bg-base)] transition-all duration-300
      `}>
        <div className="max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
