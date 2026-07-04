import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SongsueLanding } from "@/components/home/SongsueLanding";

export const dynamic = "force-dynamic";

export default async function Home() {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    console.error("Auth failed during landing page load:", err);
  }

  if (session?.user) {
    redirect(session.user.profileCompleted ? "/dashboard" : "/onboarding");
  }

  return <SongsueLanding />;
}
