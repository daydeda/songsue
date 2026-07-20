import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SongsueLanding } from "@/components/home/SongsueLanding";
import { canEnterAdminAny, effectiveRoles } from "@/lib/admin-access";
import { isRegistrationOpen } from "@/lib/registration-window";

export const dynamic = "force-dynamic";

export default async function Home() {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("Auth failed during landing page load:", err);
  }

  if (session?.user) {
    // Mirror src/proxy.ts's pre-launch gate: a signed-in user who isn't
    // preview/admin-exempt can't actually reach /dashboard or /onboarding
    // before launch — the proxy bounces them straight back to "/". Redirecting
    // them there unconditionally (the old behavior) created an infinite
    // redirect loop between this page and the proxy. Once registration opens,
    // or for exempt users, this restores the original always-redirect behavior.
    const roles = effectiveRoles(session.user.role, session.user.roles);
    const isPrelaunchExempt =
      !!session.user.previewAccess || canEnterAdminAny(roles, session.user.hasStaffPosition);
    if (isRegistrationOpen() || isPrelaunchExempt) {
      redirect(session.user.profileCompleted ? "/dashboard" : "/onboarding");
    }
  }

  return <SongsueLanding />;
}
