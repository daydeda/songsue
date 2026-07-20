import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SongsueLanding } from "@/components/home/SongsueLanding";
import { canEnterAdminAny, effectiveRoles } from "@/lib/admin-access";
import { isRegistrationOpen } from "@/lib/registration-window";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("Auth failed during login page load:", err);
  }

  // Already authenticated: go to dashboard if complete, onboarding if not —
  // but only if src/proxy.ts's pre-launch gate would actually let them land
  // there (same isRegistrationOpen/previewAccess/admin exemption check as
  // src/app/page.tsx). Redirecting unconditionally sent a signed-in,
  // non-exempt account straight into the gate, which bounced it back to "/",
  // which has no sign-in UI while pre-launch — a dead end with no way to sign
  // out or switch to an admin/previewAccess account. Falling through here
  // instead renders the real sign-in button below (Google's
  // prompt=select_account lets them pick a different account).
  if (session?.user) {
    const user = session.user;
    const roles = effectiveRoles(user.role, user.roles);
    const isPrelaunchExempt = !!user.previewAccess || canEnterAdminAny(roles, user.hasStaffPosition);
    if (isRegistrationOpen() || isPrelaunchExempt) {
      redirect(user.profileCompleted ? "/dashboard" : "/onboarding");
    }
  }

  // Auth.js redirects failed OAuth callbacks here with ?error=... (e.g.
  // "Configuration" for an InvalidCheck/PKCE cookie failure — typically an
  // expired sign-in or an in-app browser that dropped the cookie). Surface a
  // friendly, actionable banner instead of silently showing the landing page.
  const { error } = await searchParams;

  return <SongsueLanding variant="login" authError={error ?? null} />;
}
