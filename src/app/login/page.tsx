import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LandingUI } from "@/components/home/LandingUI";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("Auth failed during login page load:", err);
  }

  // Already authenticated: admins always go to dashboard, 
  // others go to dashboard if complete, onboarding if not.
  if (session?.user) {
    const user = session.user;
    const adminRoles = ["super_admin", "admin", "registration", "organizer"];
    if (adminRoles.includes(user.role || "") || user.profileCompleted) {
      redirect("/dashboard");
    } else {
      redirect("/onboarding");
    }
  }

  return <LandingUI userCount={31} />;
}
