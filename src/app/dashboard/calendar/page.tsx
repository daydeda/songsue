import { auth } from "@/auth";
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const session = await auth();
  return <CalendarClient initialSession={session} />;
}
