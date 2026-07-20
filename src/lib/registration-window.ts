/**
 * Single source of truth for the site-wide registration launch date. Shared
 * by SongsueLanding.tsx (the cosmetic countdown/lock on the landing page CTA)
 * and the edge proxy (src/proxy.ts — the REAL enforcement: pre-launch, only
 * previewAccess testers and admin-capable staff may actually reach a signed-in
 * page). Keeping both on one constant means the marketing countdown can never
 * silently drift from what's actually enforced.
 *
 * NEXT_PUBLIC_REGISTRATION_OPENS_AT (.env.local, gitignored) is a local-only
 * override that lets both the countdown AND the proxy gate be forced open for
 * testing without touching this real launch date. Edge-safe on purpose (reads
 * only process.env, imports nothing) so src/proxy.ts can use it directly.
 */
export const REGISTRATION_OPENS_AT = new Date(
  process.env.NEXT_PUBLIC_REGISTRATION_OPENS_AT || "2026-07-23T00:00:00+07:00"
).getTime();

export function isRegistrationOpen(): boolean {
  return Date.now() >= REGISTRATION_OPENS_AT;
}
