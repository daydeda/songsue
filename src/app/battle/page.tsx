import { auth } from "@/auth";
import { BattleHubClient } from "./BattleHubClient";

export const dynamic = "force-dynamic";

export default async function BattleHubPage() {
  const session = await auth();
  return <BattleHubClient initialSession={session} />;
}
