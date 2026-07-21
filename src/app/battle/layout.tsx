import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { effectiveRoles } from "@/lib/admin-access";
import { canAccessBattle } from "@/lib/battle-access";
import { BattleTestingNotice } from "./BattleTestingNotice";

// P2P Battle is open to every signed-in role (src/lib/battle-access.ts) — this
// check is now effectively a defensive fallback (BattleTestingNotice) for the
// edge case of a session with no roles at all. API routes under /api/battle
// are the real data gate regardless.
export default async function BattleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const roles = effectiveRoles(session.user.role, session.user.roles);
  if (!canAccessBattle(roles)) {
    return <BattleTestingNotice />;
  }

  return <>{children}</>;
}
