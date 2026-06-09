import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  // Protect route: if not authenticated, redirect to /login directly on the server
  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardClient initialSession={session} />;
}