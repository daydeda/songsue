import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canEnterAdminAny, isScannerOnlyAny, isScannerOnlyAllowedPath, effectiveRoles, SCANNER_HREF } from "@/lib/admin-access";
import { isSiteMoved } from "@/lib/site-moved";
import { isRegistrationOpen } from "@/lib/registration-window";

// Next.js 16: "middleware" renamed to "proxy"
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Retired "we've moved" deploy: the real app is gone and this deployment has no
  // auth/DB env. Pass every request straight through so the root layout can render
  // the self-contained MovedNotice instead of us calling auth() (which would hit the
  // missing DB and 500). The notice screen replaces the whole app regardless of path.
  if (isSiteMoved()) {
    return NextResponse.next();
  }

  // Allow public paths and Next.js internals to pass through, launch date or
  // not — these must always work regardless of the pre-launch gate below
  // (e.g. /login must always let people sign in; /api/* is excluded from this
  // proxy entirely by the matcher at the bottom of this file regardless of
  // whether it's also listed here).
  const isAlwaysPublicPath =
    pathname === "/" ||
    pathname === "/login" ||
    // Site-wide preview-access activation link (see users.previewAccess) must
    // survive the Google sign-in round-trip with its token intact — a bare
    // redirect to /login here would drop the callbackUrl. The page itself
    // handles both the unauthenticated sign-in prompt and the
    // profileCompleted/onboarding check.
    pathname === "/preview" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/smocamt-logo.png") ||
    pathname.startsWith("/smocamt-logo-icon.png") ||
    pathname.startsWith("/icon.svg") ||
    pathname.startsWith("/flag_house") ||
    pathname.startsWith("/songsue-banner.webp");

  if (isAlwaysPublicPath) {
    return NextResponse.next();
  }

  // "/dashboard" and "/dashboard/id" are public FOR GUEST BROWSING (no
  // sign-in required) — but only once registration has actually opened. Before
  // that date these must NOT shortcut past the auth/pre-launch gate below like
  // they used to (that was the bug: a general user's session was never even
  // consulted for these two paths, so nothing else in this file mattered for
  // them). Post-launch this restores the exact original guest-browsing
  // behavior.
  const isGuestDashboardPath = pathname === "/dashboard" || pathname === "/dashboard/id";
  if (isGuestDashboardPath && isRegistrationOpen()) {
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
  // to the QR scanner. A registration position (users.smoPosition/anusmoPosition,
  // distinct from role/roles) additively widens entry the same way — see admin-access.ts.
  const isScannerOnly = isScannerOnlyAny(roles, user.hasStaffPosition, user.smoPosition, user.anusmoPosition);

  // Site-wide pre-launch gate: /login itself has no gate (it must always let
  // people sign in — see its own comment), so this is the actual enforcement.
  // Before the real registration date, only previewAccess testers (see
  // users.previewAccess, redeemed via /preview) and admin-capable staff (the
  // same set /admin uses below) may reach ANY signed-in page, including
  // /onboarding — everyone else who signs in via /login lands back on the
  // locked landing page instead. Shares its date with SongsueLanding.tsx's
  // countdown via src/lib/registration-window.ts so the cosmetic lock and the
  // real one can't drift apart.
  //
  // Narrow carve-out: a brand-new user arriving via /preview?token=X doesn't
  // have previewAccess yet — that's only granted by POST /api/preview/activate,
  // which onboarding/page.tsx's ?returnTo bounces them back to AFTER they
  // finish this form (see OnboardingClient.tsx). So /onboarding is exempt only
  // when its ?returnTo points back at /preview — i.e. only mid-preview-token
  // redemption, not for a generic new sign-in. The token itself (not this
  // returnTo check) is what actually gates previewAccess, so this carve-out
  // can't be used to reach anything beyond onboarding without a real token.
  const returnTo = req.nextUrl.searchParams.get("returnTo");
  const isPreviewOnboarding = pathname === "/onboarding" && !!returnTo && returnTo.startsWith("/preview");
  const isPrelaunchExempt = !!user.previewAccess || canEnterAdminAny(roles, user.hasStaffPosition) || isPreviewOnboarding;
  if (!isRegistrationOpen() && !isPrelaunchExempt) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // profileCompleted no longer forces /onboarding here AT ALL — every
  // signed-in user (student or otherwise, synced from ActiveCAMT or a
  // completely fresh Google sign-in) lands straight on /dashboard. The full
  // 4-step wizard at /onboarding still exists and is still reachable
  // directly, but nothing routes anyone there automatically anymore.
  // Whatever's still missing — up to and including studentId/faculty for a
  // genuinely blank account — is collected by QuickProfileModal
  // (DashboardClient.tsx) at the point something first needs it (registering
  // for an event), not gated page-by-page on every route.
  //
  // The rest of the app already treats these fields as nullable throughout
  // (normalizeFaculty defaults a null faculty to CAMT, studentId displays
  // fall back to a placeholder, houseId has always been nullable pre-scan) —
  // this was already a reachable state for any ActiveCAMT-synced account
  // sitting between sync and first scan, just never one a plain Google
  // sign-in could reach before now.

  // Completed profile visiting onboarding → redirect to dashboard
  if (user.profileCompleted && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Admin routes — block anyone who can't enter the admin area at all. (SMO is
  // allowed in but is confined to the scanner by the rule below.)
  if (pathname.startsWith("/admin") && !canEnterAdminAny(roles, user.hasStaffPosition)) {
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

  // P2P Battle is open to every signed-in role (src/lib/battle-access.ts) — no
  // redirect needed here. API routes under /api/battle are the real gate
  // (this proxy never runs on /api/*).

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
  //
  // `flag_house`, `songsue-banner.webp`, and `songsue-logo.png` are excluded
  // for the same reason — the Two Media In Arts landing page (and the nav
  // bar's brand logo, visible pre-sign-in on /login) render before sign-in.
  // `icon.png` is the App Router favicon (replaced the old `icon.svg`) and
  // must stay public so the browser tab icon loads for signed-out visitors.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|smocamt-logo.png|smocamt-logo-icon.png|icon.png|songsue-logo.png|uploads|flag_house|songsue-banner.webp).*)"],
};
