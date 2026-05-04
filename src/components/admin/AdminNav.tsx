"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Calendar, 
  QrCode, 
  Users, 
  ShieldCheck, 
  User,
  ChevronRight,
  Languages
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const NAV = [
  { href: "/admin/dashboard", label: "Overview",         icon: LayoutDashboard },
  { href: "/admin/events",    label: "Manage Events",    icon: Calendar },
  { href: "/admin/scanner",   label: "QR Scanner",       icon: QrCode },
  { href: "/admin/students",  label: "Student Directory", icon: Users },
  { href: "/admin/audit-logs",label: "Audit Trails",     icon: ShieldCheck },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav style={{ flex: 1 }}>
      <p className="section-title" style={{ paddingLeft: 12, marginBottom: 12 }}>Main Menu</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`nav-link ${isActive ? "active" : ""}`} 
              style={{ gap: 12, position: "relative" }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
              {isActive && (
                <div style={{ 
                  position: "absolute", 
                  right: 12, 
                  width: 6, 
                  height: 6, 
                  borderRadius: "50%", 
                  background: "var(--accent-primary)" 
                }} />
              )}
            </Link>
          );
        })}
      </div>

      <div className="divider" style={{ margin: "24px 12px", opacity: 0.5 }} />
      <p className="section-title" style={{ paddingLeft: 12, marginBottom: 12 }}>Account</p>
      <Link href="/dashboard" className="nav-link" style={{ gap: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
        <User size={18} strokeWidth={2 } />
        <span style={{ fontWeight: 500 }}>Switch to Student View</span>
      </Link>

      <AdminLanguageSwitcher />
    </nav>
  );
}

function AdminLanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  
  return (
    <div style={{ padding: "0 12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, background: "var(--bg-elevated)", padding: 4, borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
        {(["en", "th", "mm", "cn"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            style={{
              padding: "6px 0",
              borderRadius: 8,
              border: "none",
              fontSize: 10,
              fontWeight: 800,
              cursor: "pointer",
              background: lang === l ? "var(--accent-primary)" : "transparent",
              color: lang === l ? "#fff" : "var(--text-muted)",
              transition: "all 0.2s"
            }}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
