// Who may reach the P2P Battle feature (src/app/battle/**, src/app/api/battle/**)
// while it's staged for internal testing on prod before a full student rollout.
// Pure data/predicate only — safe to import in the edge proxy. Mirrors the
// admin-access.ts pattern: proxy, battle/layout.tsx, and every battle API route
// must all import this so the gate can't drift between layers.
export const BATTLE_ALLOWED_ROLES = ["super_admin", "admin", "smo", "anusmo"] as const;

export function canAccessBattle(roles: string[]): boolean {
  return roles.some((r) => (BATTLE_ALLOWED_ROLES as readonly string[]).includes(r));
}
