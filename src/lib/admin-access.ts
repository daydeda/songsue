// Single source of truth for who may enter the admin area and where they land.
// Used by the proxy middleware (src/proxy.ts), the admin layout, and the "Admin
// Panel" entry points (StudentNav, AdminLayoutWrapper) so all four gating layers
// move together. Pure data/predicates only — safe to import in the edge proxy.
// Server-side API/route gates remain the source of truth for data access.

// Roles allowed to open the admin area at all. "smo", "club_president" and
// "major_president" are scanner-only — they can enter, but AdminNav shows just the
// Scanner and the sensitive APIs still reject them.
export const ADMIN_ENTRY_ROLES = ["super_admin", "admin", "registration", "organizer", "smo", "club_president", "major_president"] as const;

// Scanner-only roles: allowed into /admin but confined to the QR scanner.
export const SCANNER_ONLY_ROLES = ["smo", "club_president", "major_president"] as const;

// Roles permitted to award/deduct INDIVIDUAL student points in the scanner.
// "smo" keeps full scanner (check-in + scoring); the president roles are check-in
// only — they can scan attendance but must not give/deduct individual points.
// Enforced server-side in /api/admin/scan and ScannerService; the UI just hides
// the Score toggle for non-scoring roles.
export const SCORING_ROLES = ["super_admin", "admin", "registration", "organizer", "smo"] as const;

// Canonical scanner path — also the landing for scanner-only roles.
export const SCANNER_HREF = "/admin/scanner";

// Pages a scanner-only role (smo, club_president, major_president) may open.
// Besides the scanner they may now reach the events page, but ONLY to view the
// attendance roster — every other control there is hidden (see admin/events
// page) and the attendance API returns a thin roster with no phone/emergency/
// medical signal (see api/admin/events/[id]/attendance). "/admin" is allowed
// because its page just redirects to the scanner. "/admin/clubs" is allowed too,
// but only club_president gets real data there — the page renders read-only and
// scoped to just the club(s) they preside over (see GET /api/admin/clubs and
// .../[id]/members); smo/major_president reaching this path get an empty/401
// response since they preside over nothing.
export const SCANNER_ONLY_PAGES = ["/admin", SCANNER_HREF, "/admin/events", "/admin/clubs"] as const;

// May a scanner-only role reach this exact (page) path? Used by the proxy to
// confine these roles. Exact-match only — no /admin/events/* sub-pages exist.
export function isScannerOnlyAllowedPath(pathname: string): boolean {
  return (SCANNER_ONLY_PAGES as readonly string[]).includes(pathname);
}

export function canEnterAdmin(role?: string | null): boolean {
  return (ADMIN_ENTRY_ROLES as readonly string[]).includes(role || "");
}

// Scanner-only roles can enter the admin area but only reach the scanner.
export function isScannerOnlyRole(role?: string | null): boolean {
  return (SCANNER_ONLY_ROLES as readonly string[]).includes(role || "");
}

// May this role award/deduct individual student points? Excludes the president
// roles (check-in only) while keeping smo and the full admin roles.
export function canGiveIndividualScore(role?: string | null): boolean {
  return (SCORING_ROLES as readonly string[]).includes(role || "");
}

// Where an admin-capable user should land. SMO has no dashboard access, so it goes
// straight to the scanner; everyone else lands on the dashboard.
export function adminLandingHref(role?: string | null): string {
  return isScannerOnlyRole(role) ? SCANNER_HREF : "/admin/dashboard";
}

/* ---------------------------------------------------------------------------
 * Multi-role predicates. A user holds a SET of roles (users.roles[]); their
 * singular users.role is just the highest-priority one (see auth.getPrimaryRole).
 * Gating must consider ALL their roles, or a user whose admin-granting role isn't
 * the primary one (e.g. a club/major president whose primary resolves to anusmo)
 * gets locked out of the admin area even though one of their roles allows it.
 * These wrap the single-role predicates so every layer (proxy, entry points,
 * AdminNav, landing) stays consistent with admin/layout.tsx.
 * ------------------------------------------------------------------------- */

// Full-admin roles = admin-entry roles that are NOT scanner-only. Holding any of
// these means a real admin (dashboard + their allowed sections), not scanner-confined.
const FULL_ADMIN_ROLES = (ADMIN_ENTRY_ROLES as readonly string[]).filter(
  (r) => !(SCANNER_ONLY_ROLES as readonly string[]).includes(r)
);

// Resolve a user's effective role set: roles[] when populated, else the singular
// role, else "student". (An empty roles[] is truthy, so `roles || [role]` would
// wrongly yield [] and lock the user out — mirror auth.getPrimaryRole's guard.)
export function effectiveRoles(role?: string | null, roles?: string[] | null): string[] {
  if (roles && roles.length > 0) return roles;
  return role ? [role] : ["student"];
}

// May any of these roles enter the admin area at all?
export function canEnterAdminAny(roles: string[]): boolean {
  return roles.some(canEnterAdmin);
}

// Scanner-only iff the set can enter admin but holds NO full-admin role — i.e.
// every admin-granting role they have is scanner-only.
export function isScannerOnlyAny(roles: string[]): boolean {
  return canEnterAdminAny(roles) && !roles.some((r) => FULL_ADMIN_ROLES.includes(r));
}

// May any of these roles award/deduct individual student points?
export function canGiveIndividualScoreAny(roles: string[]): boolean {
  return roles.some(canGiveIndividualScore);
}

// Landing href for a role set (scanner-only → scanner, else dashboard).
export function adminLandingHrefForRoles(roles: string[]): string {
  return isScannerOnlyAny(roles) ? SCANNER_HREF : "/admin/dashboard";
}
