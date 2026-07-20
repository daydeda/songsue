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
  Building2,
  GraduationCap,
  User,
  MessageSquareWarning,
  KeyRound,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { isScannerOnlyAny, isGlobalRegistrationPosition } from "@/lib/admin-access";

// Grouped by topic so the sidebar reads as sections rather than one long list.
// `titleKey` is null for the ungrouped top item (Overview); every other group
// gets a small uppercase subheading (i18n'd) and is dropped entirely if none
// of its items survive the role filter below.
//
// Clubs and Appeals stay in this list even though full-admin roles no longer
// see them (itemAllowed hides them below) — scanner-only roles (club_president,
// major_president, smo) still need these two entries to render their own nav.
// Proposals/Pending Reviews/Shop have no scanner-only dependency, so they're
// just gone: Proposals/Reviews are nav-hidden only (pages+APIs still work,
// reachable by URL) — see itemAllowed; Shop's page+API were deleted outright.
const NAV_GROUPS = [
  { titleKey: null, items: [
      { href: "/admin/dashboard", key: "overview", icon: LayoutDashboard },
    ] },
  { titleKey: "navGroupEvents", items: [
      { href: "/admin/events",    key: "manageEvents",   icon: Calendar },
      { href: "/admin/scanner",   key: "qrScanner",      icon: QrCode },
      { href: "/admin/appeals",   key: "manageAppeals",  icon: MessageSquareWarning },
    ] },
  { titleKey: "navGroupCommunity", items: [
      { href: "/admin/clubs",    key: "manageClubs",           icon: Building2 },
      { href: "/admin/majors",   key: "manageMajors",          icon: GraduationCap },
      { href: "/admin/students", key: "adminStudentsDirectory",icon: Users },
    ] },
  { titleKey: "navGroupContent", items: [
      { href: "/admin/announcement", key: "manageAnnouncement", icon: Megaphone },
    ] },
  { titleKey: "navGroupSystem", items: [
      { href: "/admin/audit-logs", key: "auditTrails", icon: ShieldCheck },
      { href: "/admin/settings",   key: "manageSettings", icon: KeyRound },
    ] },
] as const;

export function AdminNav({
  roles,
  hasStaffPosition,
  hasClubPosition,
  smoPosition,
  anusmoPosition,
}: {
  roles: string[];
  hasStaffPosition?: boolean;
  hasClubPosition?: boolean;
  smoPosition?: string | null;
  anusmoPosition?: string | null;
}) {
  const pathname = usePathname();
  const { t } = useLanguage();

  // A user may hold several roles; show an item if ANY of their roles is allowed to
  // see it (union of permissions). Matches the page + API gates and admin-access.
  const has = (allowed: string[]) => roles.some((r) => allowed.includes(r));
  const scannerOnly = isScannerOnlyAny(roles, hasStaffPosition, smoPosition, anusmoPosition);
  // A GLOBAL registration position (smo/anusmo + position="registration") gets nav
  // parity with the "registration" role for the items that role set already covers.
  const globalReg = isGlobalRegistrationPosition(roles, smoPosition, anusmoPosition);
  const canSeeStudents = has(["super_admin", "admin", "registration"]) || globalReg; // organizer barred
  const canSeeAudit = has(["super_admin", "admin"]);                    // organizer + registration barred
  const canManage = has(["super_admin", "admin"]);                      // announcement
  const canManageSettings = has(["super_admin"]);                       // settings (preview-access token)

  const itemAllowed = (item: { href: string }) => {
    // Scanner-only users (smo, club/major president, no full-admin role) see just the
    // QR Scanner, Events (attendance-view only) and Appeals. Shared predicate so this
    // can't drift from proxy/admin-access. club_president additionally sees Clubs with
    // full (own-club) roster access; a non-president staff position (secretary,
    // finance, ... — src/lib/positions.ts) also sees Clubs, but read-only and further
    // scoped to just their own club — see admin/clubs/page.tsx's isClubStaffViewer +
    // its APIs' staff-position tier. Appeals itself is view-only for smo and
    // owned-events-only for club/major president (VIEW_APPEALS_ROLES/
    // RESOLVE_APPEALS_ROLES, src/lib/strikes.ts) — the page/API enforce that; the nav
    // just decides whether the link shows at all.
    if (scannerOnly) {
      return (
        item.href === "/admin/scanner" ||
        item.href === "/admin/events" ||
        item.href === "/admin/appeals" ||
        (item.href === "/admin/clubs" && (roles.includes("club_president") || !!hasClubPosition)) ||
        (item.href === "/admin/majors" && roles.includes("major_president"))
      );
    }
    // Majors nav: the major_president analogue of Clubs — but unlike Clubs
    // (which staff also manage identity/membership for), there's no staff-facing
    // "majors directory" concept, so this is gated to holding the role itself,
    // not folded into the `return true` full-admin fallback below.
    if (item.href === "/admin/majors") return roles.includes("major_president");
    if (item.href === "/admin/students") return canSeeStudents;
    // Clubs and Appeals stay reachable (club identity mgmt / appeals still work for
    // full admins by direct URL) but are dropped from the full-admin sidebar itself —
    // only scanner-only roles see them, via the branch above.
    if (item.href === "/admin/clubs") return false;
    if (item.href === "/admin/appeals") return false;
    if (item.href === "/admin/audit-logs") return canSeeAudit;
    if (item.href === "/admin/announcement") return canManage;
    if (item.href === "/admin/settings") return canManageSettings;
    return true; // dashboard, events, scanner — every full-admin role
  };

  const filteredGroups = NAV_GROUPS
    .map(group => ({ ...group, items: group.items.filter(itemAllowed) }))
    .filter(group => group.items.length > 0);

  return (
    <nav style={{ flex: 1 }}>
      <p className="section-title" style={{ paddingLeft: 0, marginBottom: 16 }}>{t.mainMenu}</p>
      {filteredGroups.map((group, groupIndex) => (
        <div key={group.titleKey ?? "ungrouped"} style={{ marginTop: groupIndex === 0 ? 0 : 20 }}>
          {group.titleKey && (
            <p
              className="section-title"
              style={{ paddingLeft: 0, marginBottom: 8, fontSize: 10, opacity: 0.7 }}
            >
              {t[group.titleKey] || group.titleKey}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {group.items.map((item) => {
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
        </div>
      ))}

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
