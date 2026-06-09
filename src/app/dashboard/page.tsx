import { auth } from "@/auth";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();

  return <DashboardClient initialSession={session} />;
}