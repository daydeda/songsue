import { auth } from "@/auth";
import { JoinClient } from "./JoinClient";

export const dynamic = "force-dynamic";

export default async function JoinGamePage() {
  const session = await auth();
  return <JoinClient initialSession={session} />;
}
