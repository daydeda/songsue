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

  // If onboarding is already completed (or user is an admin), redirect to dashboard
  const user = session.user;
  const adminRoles = ["super_admin", "admin", "registration", "organizer"];
  if (adminRoles.includes(user.role || "") || user.profileCompleted) {
    redirect("/dashboard");
  }

  return <OnboardingClient initialSession={session} />;
}