import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LandingUI } from "@/components/home/LandingUI";
import { db } from "@/db";
import { users } from "@/db/schema";
import { count, isNotNull, and, ne } from "drizzle-orm";

export default async function Home() {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("Auth failed during landing page load:", err);
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

  // Fetch real stats for social proof (FE-01)
  let userCount = 0;
  let sampleImages: string[] = [];
  try {
    const [{ count: countVal }] = await db.select({ count: count() }).from(users);
    userCount = countVal;
    
    const sampleUsers = await db
      .select({ image: users.image })
      .from(users)
      .where(and(isNotNull(users.image), ne(users.image, "")))
      .limit(4);
    sampleImages = sampleUsers.map(u => u.image as string);
  } catch (err) {
    console.error("Failed to fetch social proof stats from DB:", err);
  }

  return <LandingUI userCount={userCount} sampleImages={sampleImages} />;
}
