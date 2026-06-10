import { auth } from "@/auth";
import { redirect } from "next/navigation";
import OnboardingClient from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await auth();

  // Protect route: if not authenticated, redirect to /login directly on the server
  if (!session?.user) {
    redirect("/login");
  }

  // If onboarding is already completed, redirect to dashboard
  const user = session.user;
  if (user.profileCompleted) {
    redirect("/dashboard");
  }

  return <OnboardingClient initialSession={session} />;
}