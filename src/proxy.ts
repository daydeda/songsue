import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16: "middleware" renamed to "proxy"
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and Next.js internals to pass through
  const isPublicPath =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/login" ||
    pathname === "/api/events" ||
    pathname === "/api/houses" ||
    pathname === "/api/realtime" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/smocamt-logo.png") ||
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

  const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(user.role || "");

  // Authenticated but profile not complete → force onboarding
  // (except for admins, the /onboarding page itself, and API routes)
  if (
    !user.profileCompleted &&
    !isAdminRole &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Completed profile visiting onboarding → redirect to dashboard
  if (user.profileCompleted && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Admin-only routes — block non-admins
  if (pathname.startsWith("/admin") && !isAdminRole) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Organizer cannot access students list
  if (pathname.startsWith("/admin/students") && user.role === "organizer") {
    return NextResponse.redirect(new URL("/admin/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|smocamt-logo.png|icon.png).*)"],
};
