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
        <div style={{ marginBottom: 40, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/admin/dashboard" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
            <div style={{ 
              width: 44, 
              height: 44, 
              background: "var(--accent-primary)", 
              borderRadius: "50%", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "white", 
              fontWeight: 900, 
              fontSize: 20,
              boxShadow: "0 4px 12px var(--accent-primary)44"
            }}>A</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ 
                fontSize: 22, 
                fontWeight: 900, 
                color: "var(--text-primary)", 
                letterSpacing: "-0.03em",
                lineHeight: 1
              }}>
                Active<span style={{ color: "var(--accent-primary)" }}>CAMT</span>
              </span>
              <span style={{ 
                fontSize: 10, 
                fontWeight: 800, 
                color: "var(--text-muted)", 
                textTransform: "uppercase", 
                letterSpacing: "0.15em",
                marginTop: 4
              }}>Admin Panel</span>
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

      <main className="admin-main">
        <div className="max-w-[1400px] mx-auto w-full">
          {children}
        </div>
      </main>

      <style jsx>{`
        .admin-main {
          flex: 1;
          overflow-y: auto;
          background: var(--bg-base);
          transition: all 0.3s ease;
          padding-left: 16px;
          padding-right: 16px;
          padding-bottom: 32px;
          padding-top: 112px;
        }
        @media (min-width: 640px) {
          .admin-main {
            padding-left: 24px;
            padding-right: 24px;
            padding-top: 128px;
          }
        }
        @media (min-width: 1024px) {
          .admin-main {
            padding-left: 40px;
            padding-right: 40px;
            padding-top: 80px;
            padding-bottom: 48px;
          }
        }
        @media (min-width: 1280px) {
          .admin-main {
            padding-left: 56px;
            padding-right: 56px;
            padding-top: 96px;
          }
        }
      `}</style>
    </div>
  );
}
