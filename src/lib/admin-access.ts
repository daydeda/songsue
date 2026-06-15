// Single source of truth for who may enter the admin area and where they land.
// Used by the proxy middleware (src/proxy.ts), the admin layout, and the "Admin
// Panel" entry points (StudentNav, AdminLayoutWrapper) so all four gating layers
// move together. Pure data/predicates only — safe to import in the edge proxy.
// Server-side API/route gates remain the source of truth for data access.

// Roles allowed to open the admin area at all. "smo" is scanner-only — it can enter,
// but AdminNav shows just the Scanner and the sensitive APIs still reject it.
export const ADMIN_ENTRY_ROLES = ["super_admin", "admin", "registration", "organizer", "smo"] as const;

// Scanner-only roles: allowed into /admin but confined to the QR scanner.
export const SCANNER_ONLY_ROLES = ["smo"] as const;

// Canonical scanner path — also the landing for scanner-only roles.
export const SCANNER_HREF = "/admin/scanner";

export function canEnterAdmin(role?: string | null): boolean {
  return (ADMIN_ENTRY_ROLES as readonly string[]).includes(role || "");
}

// Scanner-only roles can enter the admin area but only reach the scanner.
export function isScannerOnlyRole(role?: string | null): boolean {
  return (SCANNER_ONLY_ROLES as readonly string[]).includes(role || "");
}

// Where an admin-capable user should land. SMO has no dashboard access, so it goes
// straight to the scanner; everyone else lands on the dashboard.
export function adminLandingHref(role?: string | null): string {
  return isScannerOnlyRole(role) ? SCANNER_HREF : "/admin/dashboard";
}
