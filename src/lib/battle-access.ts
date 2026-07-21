// Who may reach the P2P Battle feature (src/app/battle/**, src/app/api/battle/**).
// Was staged to SMO/ANUSMO/Admin only for internal testing on prod; now open to
// every signed-in role for the full rollout. Pure data/predicate only — safe to
// import in the edge proxy. Mirrors the admin-access.ts pattern: proxy,
// battle/layout.tsx, and every battle API route must all import this so the
// gate can't drift between layers.
export function canAccessBattle(roles: string[]): boolean {
  return roles.length > 0;
}
