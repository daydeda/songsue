import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canEnterAdminAny, isScannerOnlyAny, isScannerOnlyAllowedPath, effectiveRoles, SCANNER_HREF } from "@/lib/admin-access";

// Next.js 16: "middleware" renamed to "proxy"
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and Next.js internals to pass through
  const isPublicPath =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/dashboard/id" ||
    pathname === "/login" ||
    pathname === "/api/events" ||
    pathname === "/api/houses" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/smocamt-logo.png") ||
    pathname.startsWith("/smocamt-logo-icon.png") ||
    pathname.startsWith("/icon.png");

  if (isPublicPath) {
    return NextResponse.next();
  }

  const session = await auth();

  // Not authenticated → redirect to login page
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const user = session.user;
  // A user may hold several roles; gate on the whole set, not just the primary one
  // (else a president whose primary resolves to a non-entry role is wrongly blocked).
  const roles = effectiveRoles(user.role, user.roles);
  // Scanner-only roles (smo, club/major president) may enter /admin but are confined
  // to the QR scanner.
  const isScannerOnly = isScannerOnlyAny(roles);

  // Authenticated but profile not complete → force onboarding
  // (except for the /onboarding page itself, and API routes)
  if (
    !user.profileCompleted &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Completed profile visiting onboarding → redirect to dashboard
  if (user.profileCompleted && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Admin routes — block anyone who can't enter the admin area at all. (SMO is
  // allowed in but is confined to the scanner by the rule below.)
  if (pathname.startsWith("/admin") && !canEnterAdminAny(roles)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Scanner-only roles (smo, club_president, major_president) are confined to the
  // scanner plus the events page (attendance-view only — see isScannerOnlyAllowedPath).
  // Any other /admin/* path bounces back to the scanner.
  if (
    isScannerOnly &&
    pathname.startsWith("/admin") &&
    !isScannerOnlyAllowedPath(pathname)
  ) {
    return NextResponse.redirect(new URL(SCANNER_HREF, req.url));
  }

  // Organizer cannot access students list. Gate on the role SET (like the rest of
  // this proxy) so it can't desync from ROLE_PRIORITY: redirect only when the user
  // is an organizer with no higher students-capable role. Restrictive-only; the
  // students API remains the real gate.
  const organizerOnly = roles.includes("organizer") && !roles.some((r) => ["super_admin", "admin", "registration"].includes(r));
  if (pathname.startsWith("/admin/students") && organizerOnly) {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // NOTE: this matcher excludes ALL `/api/*` — the proxy never runs on API
  // routes. The tokenized calendar feed (/api/calendar/feed/[token]) relies on
  // that: it is public-by-design and authenticates via its per-user secret token
  // inside the route handler. Do NOT add it to isPublicPath (no effect on /api)
  // or start gating /api here without revisiting that route's own auth.
  //
  // `uploads` is excluded so public posters/avatars/QR — served from disk as
  // /uploads/* on the self-hosted deploy — bypass the auth gate. They are public
  // assets (private slips/form docs live in .uploads-private behind an auth API),
  // and gating them sent <img> requests to /login, rendering as broken images.
  // Supabase-backed deploys serve these from a cross-origin URL the proxy never
  // sees, so this only affects the self-hosted (local-disk) deploy.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|smocamt-logo.png|smocamt-logo-icon.png|icon.png|uploads).*)"],
};
