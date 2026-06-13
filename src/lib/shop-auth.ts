import type { Session } from "next-auth";

// Who may manage the shop (create products, set the QR, approve orders). Mirrors
// the announcement gate: super_admin + admin only — registration/organizer can
// enter /admin but must not touch money/merch. Checks the full roles array since
// a user can hold several roles.
export function isShopAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  const roles = session.user.roles ?? (session.user.role ? [session.user.role] : []);
  return roles.some((r) => r === "super_admin" || r === "admin");
}
