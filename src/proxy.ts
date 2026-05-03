import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16: "middleware" renamed to "proxy"
export async function proxy(req: NextRequest) {
  const session = await auth();
  const { pathname } = req.nextUrl;

  // Allow public paths and Next.js internals to pass through
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico");

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Not authenticated → redirect to home (sign-in page)
  if (!session?.user) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const user = session.user as any;

  // Authenticated but profile not complete → force onboarding
  // (except /onboarding itself and API routes)
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

  // Admin-only routes — block non-admins
  if (pathname.startsWith("/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
