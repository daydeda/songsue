import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canEnterAdmin, isScannerOnlyRole, SCANNER_HREF } from "@/lib/admin-access";

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
  // SMO is scanner-only: it may enter /admin but is confined to the QR scanner.
  const isScannerOnly = isScannerOnlyRole(user.role);

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
  if (pathname.startsWith("/admin") && !canEnterAdmin(user.role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // SMO is scanner-only: keep it on the scanner. "/admin" itself is allowed because
  // its page redirects to the scanner; every other /admin/* path is off-limits.
  if (
    isScannerOnly &&
    pathname.startsWith("/admin") &&
    pathname !== "/admin" &&
    pathname !== SCANNER_HREF
  ) {
    return NextResponse.redirect(new URL(SCANNER_HREF, req.url));
  }

  // Organizer cannot access students list
  if (pathname.startsWith("/admin/students") && user.role === "organizer") {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|smocamt-logo.png|smocamt-logo-icon.png|icon.png).*)"],
};
