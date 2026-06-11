import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LandingUI } from "@/components/home/LandingUI";

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

  // Already authenticated: go to dashboard if complete, onboarding if not.
  if (session?.user) {
    const user = session.user;
    if (user.profileCompleted) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  // Auth.js redirects failed OAuth callbacks here with ?error=... (e.g.
  // "Configuration" for an InvalidCheck/PKCE cookie failure — typically an
  // expired sign-in or an in-app browser that dropped the cookie). Surface a
  // friendly, actionable banner instead of silently showing the landing page.
  const { error } = await searchParams;

  return <LandingUI userCount={31} authError={error ?? null} />;
}
