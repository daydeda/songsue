"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  QrCode,
  Users,
  ShieldCheck,
  Megaphone,
  ShoppingBag,
  Building2,
  User,
  MessageSquareWarning
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { isScannerOnlyAny } from "@/lib/admin-access";

const NAV = [
  { href: "/admin/dashboard", key: "overview",             icon: LayoutDashboard },
  { href: "/admin/events",    key: "manageEvents",         icon: Calendar },
  { href: "/admin/scanner",   key: "qrScanner",            icon: QrCode },
  { href: "/admin/students",  key: "adminStudentsDirectory",icon: Users },
  { href: "/admin/appeals",   key: "manageAppeals",        icon: MessageSquareWarning },
  { href: "/admin/clubs",     key: "manageClubs",          icon: Building2 },
  { href: "/admin/audit-logs",key: "auditTrails",          icon: ShieldCheck },
  { href: "/admin/announcement",key: "manageAnnouncement", icon: Megaphone },
  { href: "/admin/shop",      key: "manageShop",           icon: ShoppingBag },
] as const;

export function AdminNav({ roles }: { roles: string[] }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  // A user may hold several roles; show an item if ANY of their roles is allowed to
  // see it (union of permissions). Matches the page + API gates and admin-access.
  const has = (allowed: string[]) => roles.some((r) => allowed.includes(r));
  const scannerOnly = isScannerOnlyAny(roles);
  const canSeeStudents = has(["super_admin", "admin", "registration"]); // organizer barred
  const canSeeAudit = has(["super_admin", "admin"]);                    // organizer + registration barred
  const canManage = has(["super_admin", "admin"]);                      // announcement + shop
  const canSeeClubs = has(["super_admin", "admin"]);                    // club identity management

  const filteredNav = NAV.filter(item => {
    // Scanner-only users (smo, club/major president, no full-admin role) see just the
    // QR Scanner plus the Events page (attendance-view only). Shared predicate so this
    // can't drift from proxy/admin-access. club_president additionally sees Clubs, but
    // scoped read-only to their own club's roster (see admin/clubs/page.tsx + its APIs).
    if (scannerOnly) {
      return (
        item.href === "/admin/scanner" ||
        item.href === "/admin/events" ||
        (item.href === "/admin/clubs" && roles.includes("club_president"))
      );
    }
    if (item.href === "/admin/students") return canSeeStudents;
    if (item.href === "/admin/clubs") return canSeeClubs;
    if (item.href === "/admin/audit-logs") return canSeeAudit;
    if (item.href === "/admin/announcement" || item.href === "/admin/shop") return canManage;
    // Resolving an appeal resets strikes — same super_admin/admin-only scope as
    // RESET_STRIKES_ROLES in src/lib/strikes.ts.
    if (item.href === "/admin/appeals") return canManage;
    return true; // dashboard, events, scanner — every full-admin role
  });

  return (
    <nav style={{ flex: 1 }}>
      <p className="section-title" style={{ paddingLeft: 0, marginBottom: 16 }}>{t.mainMenu}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const labelText = t[item.key] || item.key;
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`nav-link ${isActive ? "active" : ""}`} 
              style={{ gap: 12, position: "relative" }}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ pointerEvents: "none" }} />
              <span style={{ fontWeight: isActive ? 700 : 500, pointerEvents: "none" }}>{labelText}</span>
              {isActive && (
                <div style={{ 
                  position: "absolute", 
                  right: 12, 
                  width: 6, 
                  height: 6, 
                  borderRadius: "50%", 
                  background: "var(--accent-primary)",
                  pointerEvents: "none"
                }} />
              )}
            </Link>
          );
        })}
      </div>

      <div className="divider" style={{ margin: "24px 0", opacity: 0.5 }} />
      <p className="section-title" style={{ paddingLeft: 0, marginBottom: 16 }}>{t.accountLabel}</p>
      <Link href="/dashboard" className="nav-link" style={{ gap: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
        <User size={18} strokeWidth={2} style={{ pointerEvents: "none" }} />
        <span style={{ fontWeight: 500, pointerEvents: "none" }}>{t.switchToStudentView}</span>
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
