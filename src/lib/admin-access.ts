// Shared client-side helpers for who may enter the admin area and where they land.
// Kept in one place so the "Admin Panel" entry points (StudentNav, AdminLayoutWrapper)
// stay in sync. Server-side API/route gates remain the source of truth for data access.

// Roles allowed to open the admin area at all. "smo" is scanner-only — it can enter,
// but AdminNav shows just the Scanner and the sensitive APIs still reject it.
export const ADMIN_ENTRY_ROLES = ["super_admin", "admin", "registration", "organizer", "smo"] as const;

export function canEnterAdmin(role?: string | null): boolean {
  return (ADMIN_ENTRY_ROLES as readonly string[]).includes(role || "");
}

// Where an admin-capable user should land. SMO has no dashboard access, so it goes
// straight to the scanner; everyone else lands on the dashboard.
export function adminLandingHref(role?: string | null): string {
  return role === "smo" ? "/admin/scanner" : "/admin/dashboard";
}
