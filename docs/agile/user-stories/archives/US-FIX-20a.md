# User Story: US-FIX-20a - à¹€à¸žà¸´à¹ˆà¸¡ Database Schema + Migration à¸‚à¸­à¸‡à¸•à¸²à¸£à¸²à¸‡à¹€à¸à¸¡ à¹à¸¥à¸°à¸¥à¸š Runtime DDL

**Status:** ðŸ” Implemented â€” In Review (commit `65dd566`, à¸—à¸”à¸ªà¸­à¸š local à¹à¸¥à¹‰à¸§ 2026-07-02)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../../report/2026-07-02-p2p-game-recheck.md)
**Priority:** ðŸ”´ Crucial â€” **à¸•à¹‰à¸­à¸‡à¸—à¸³à¸à¹ˆà¸­à¸™ story à¸­à¸·à¹ˆà¸™à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”à¹ƒà¸™ epic à¸™à¸µà¹‰**
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## ðŸ“– Description
**à¹ƒà¸™à¸à¸²à¸™à¸°** à¸™à¸±à¸à¸žà¸±à¸’à¸™à¸²à¸£à¸°à¸šà¸š
**à¸‰à¸±à¸™à¸•à¹‰à¸­à¸‡à¸à¸²à¸£** à¹ƒà¸«à¹‰à¸•à¸²à¸£à¸²à¸‡ `game_rooms`, `webrtc_signals`, `game_stats` à¸–à¸¹à¸à¸›à¸£à¸°à¸à¸²à¸¨à¹ƒà¸™ Drizzle schema (`src/db/schema.ts`) à¸žà¸£à¹‰à¸­à¸¡ migration file à¸•à¸²à¸¡à¸¡à¸²à¸•à¸£à¸à¸²à¸™à¹‚à¸›à¸£à¹€à¸ˆà¸„ à¹à¸—à¸™à¸à¸²à¸£à¸ªà¸£à¹‰à¸²à¸‡à¸•à¸²à¸£à¸²à¸‡à¹à¸šà¸š runtime à¸”à¹‰à¸§à¸¢ `ensureGameTables()`
**à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰** à¹‚à¸›à¸£à¹€à¸ˆà¸„ compile/build à¸œà¹ˆà¸²à¸™, à¸•à¸²à¸£à¸²à¸‡à¸–à¸¹à¸à¸ªà¸£à¹‰à¸²à¸‡à¸œà¹ˆà¸²à¸™ migration à¸—à¸µà¹ˆ review à¹„à¸”à¹‰ à¹à¸¥à¸°à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸²à¸£à¸£à¸±à¸™ DDL à¸ˆà¸²à¸ request path à¸šà¸™ production

## ðŸ› à¸—à¸µà¹ˆà¸¡à¸²à¸‚à¸­à¸‡à¸›à¸±à¸à¸«à¸² (à¸ˆà¸²à¸ Recheck Report)
1. à¸—à¸¸à¸ route à¹ƒà¸•à¹‰ `src/app/api/battle/` import `gameRooms` / `gameStats` / `webrtcSignals` à¸ˆà¸²à¸ `@/db/schema` à¹à¸•à¹ˆ schema.ts **à¹„à¸¡à¹ˆà¸¡à¸µà¸•à¸²à¸£à¸²à¸‡à¹€à¸«à¸¥à¹ˆà¸²à¸™à¸µà¹‰** â†’ `npx tsc --noEmit` error 69 à¸ˆà¸¸à¸”, `npm run build` à¹„à¸¡à¹ˆà¸œà¹ˆà¸²à¸™ (FIX-1)
2. `src/db/ensure-tables.ts` à¸£à¸±à¸™ `CREATE TABLE IF NOT EXISTS` 6 à¸„à¸³à¸ªà¸±à¹ˆà¸‡à¸ˆà¸²à¸ request path **à¸à¹ˆà¸­à¸™ check auth**, à¸à¸¥à¸·à¸™ error à¸—à¸´à¹‰à¸‡ à¹à¸¥à¸°à¸‚à¹‰à¸²à¸¡ flow migration à¸‚à¸­à¸‡à¹‚à¸›à¸£à¹€à¸ˆà¸„ (FIX-3)

---

## âœ… Acceptance Criteria
1. [x] `src/db/schema.ts` à¸¡à¸µ table definitions à¸‚à¸­à¸‡ `game_rooms`, `webrtc_signals`, `game_stats` à¸„à¸£à¸šà¸—à¸¸à¸ column à¸•à¸£à¸‡à¸•à¸²à¸¡à¸—à¸µà¹ˆ routes à¹ƒà¸Šà¹‰à¸‡à¸²à¸™ (à¸­à¹‰à¸²à¸‡à¸­à¸´à¸‡ DDL à¹ƒà¸™ `src/db/ensure-tables.ts` à¹€à¸”à¸´à¸¡à¹€à¸›à¹‡à¸™ spec)
2. [x] à¸¡à¸µ relations à¸„à¸£à¸š: `gameRooms.host`, `gameRooms.guest` (â†’ users), `gameStats.user` (â†’ users), à¹à¸¥à¸° index/unique index à¹€à¸”à¸´à¸¡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” (`room_code`, `status`, `(room_id, role)`, `(user_id, game_type)`) â€” à¹à¸–à¸¡ `winner` relation à¹à¸¥à¸° reverse relations à¸à¸±à¹ˆà¸‡ users
3. [x] à¸ªà¸£à¹‰à¸²à¸‡ migration à¹à¸¥à¹‰à¸§ â€” path à¸ˆà¸£à¸´à¸‡à¸„à¸·à¸­ `src/db/migrate.ts` step 58 (idempotent âœ“) âš ï¸ **à¸‚à¹‰à¸­à¸„à¸§à¸£à¸£à¸°à¸§à¸±à¸‡:** à¹„à¸Ÿà¸¥à¹Œ `drizzle/0010_giant_dragon_lord.sql` à¸—à¸µà¹ˆ generate à¸¡à¸²à¹„à¸¡à¹ˆ idempotent (CREATE TABLE à¹€à¸›à¸¥à¹ˆà¸²) à¹à¸¥à¸°à¸žà¹ˆà¸§à¸‡ drift à¹€à¸à¹ˆà¸² (`calendar_entries.recurrence`, `shop_variants.price_delta`) â€” à¹€à¸›à¹‡à¸™ snapshot bookkeeping à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ **à¸«à¹‰à¸²à¸¡à¸£à¸±à¸™à¹„à¸Ÿà¸¥à¹Œà¸™à¸µà¹‰à¸•à¸£à¸‡à¹† à¸à¸±à¸š DB à¸—à¸µà¹ˆà¸¡à¸µà¸‚à¸­à¸‡à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§**
4. [x] à¸¥à¸š `src/db/ensure-tables.ts` à¹à¸¥à¸°à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸ `ensureGameTables()` à¸­à¸­à¸à¸ˆà¸²à¸à¸—à¸¸à¸ route à¹à¸¥à¹‰à¸§ (à¸•à¸£à¸§à¸ˆà¸”à¹‰à¸§à¸¢ grep = 0 à¸ˆà¸¸à¸”) + à¹‚à¸šà¸™à¸±à¸ª: à¹à¸à¹‰ `cell as any` à¹€à¸›à¹‡à¸™ union type
5. [x] `npx tsc --noEmit` à¸œà¹ˆà¸²à¸™ âœ“ (0 error), `npm run build` à¸œà¹ˆà¸²à¸™ âœ“, vitest à¸œà¹ˆà¸²à¸™ âœ“, `npm run lint` à¸œà¹ˆà¸²à¸™ âœ“ â€” lint errors à¸—à¸µà¹ˆà¹€à¸„à¸¢à¸„à¹‰à¸²à¸‡à¸–à¸¹à¸à¸›à¸´à¸”à¸„à¸£à¸šà¹ƒà¸™ [US-FIX-20i](US-FIX-20i.md) (2026-07-02)
6. [x] à¸—à¸”à¸ªà¸­à¸šà¸šà¸™ local à¹à¸¥à¹‰à¸§ (2026-07-02) â€” à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹ƒà¸™à¸«à¸±à¸§à¸‚à¹‰à¸­ "ðŸ§ª à¸œà¸¥à¸à¸²à¸£à¸—à¸”à¸ªà¸­à¸š" à¸”à¹‰à¸²à¸™à¸¥à¹ˆà¸²à¸‡

## ðŸ§ª à¸œà¸¥à¸à¸²à¸£à¸—à¸”à¸ªà¸­à¸š (2026-07-02, local PGlite â€” à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¹„à¸¡à¹ˆà¸¡à¸µ Docker)
- à¸ªà¸£à¹‰à¸²à¸‡ PGlite DB à¸ªà¸”à¸ˆà¸²à¸ schema (`drizzle-kit push` driver pglite) + seed houses â†’ à¸•à¸²à¸£à¸²à¸‡ `game_rooms`/`webrtc_signals`/`game_stats` à¸–à¸¹à¸à¸ªà¸£à¹‰à¸²à¸‡à¸„à¸£à¸š
- à¸£à¸±à¸™ `next dev` (DB_TYPE=pglite) + login à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™ 2 à¸„à¸™à¸œà¹ˆà¸²à¸™ dev bypass â†’ à¹€à¸¥à¹ˆà¸™à¹€à¸à¸¡à¹€à¸•à¹‡à¸¡ flow à¸œà¹ˆà¸²à¸™ API:
  create room (`8WBQ`) â†’ join â†’ active â†’ à¹€à¸”à¸´à¸™à¸«à¸¡à¸²à¸à¸ªà¸¥à¸±à¸šà¸à¸±à¸™ â†’ host à¸Šà¸™à¸°à¹à¸™à¸§à¸™à¸­à¸™ â†’ `status=finished, reason=win` âœ“
- à¸à¸•à¸´à¸à¸²à¸–à¸¹à¸ enforce à¸„à¸£à¸š: à¹€à¸”à¸´à¸™à¸œà¸´à¸”à¸•à¸² â†’ `Not your turn` âœ“, à¹€à¸”à¸´à¸™à¸Šà¹ˆà¸­à¸‡à¸‹à¹‰à¸³ â†’ `Illegal move` âœ“, à¹€à¸”à¸´à¸™à¸«à¸¥à¸±à¸‡à¸ˆà¸šà¹€à¸à¸¡ â†’ `Game is not active` âœ“, à¹„à¸¡à¹ˆ login â†’ `401 Unauthorized` âœ“
- à¸ªà¸–à¸´à¸•à¸´à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¹„à¸¡à¹ˆà¸™à¸±à¸šà¸‹à¹‰à¸³: host `W1 streak1 total1`, guest `L1 total1`; leaderboard join à¸‚à¹‰à¸­à¸¡à¸¹à¸¥ user à¸ªà¸³à¹€à¸£à¹‡à¸ˆ âœ“
- **à¸¢à¸±à¸‡à¹„à¸¡à¹ˆà¸„à¸£à¸­à¸šà¸„à¸¥à¸¸à¸¡:** (à¸) WebRTC à¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡ 2 browser à¸ˆà¸£à¸´à¸‡ (à¸¡à¸µ bug teardown à¸­à¸¢à¸¹à¹ˆà¹à¸¥à¹‰à¸§ â†’ [US-FIX-20c](US-FIX-20c.md)), (à¸‚) rehearsal `migrate.ts` à¸à¸±à¸š Postgres à¸ˆà¸£à¸´à¸‡ â€” à¹€à¸„à¸£à¸·à¹ˆà¸­à¸‡à¸™à¸µà¹‰à¹„à¸¡à¹ˆà¸¡à¸µ Docker/Postgres; à¸•à¹‰à¸­à¸‡ rehearse à¸•à¸²à¸¡ `/safe-deploy` à¸à¹ˆà¸­à¸™ deploy à¸ˆà¸£à¸´à¸‡
- **à¸Šà¹ˆà¸­à¸‡à¸§à¹ˆà¸²à¸‡à¸—à¸µà¹ˆà¸žà¸šà¸£à¸°à¸«à¸§à¹ˆà¸²à¸‡à¸—à¸”à¸ªà¸­à¸š:** à¹‚à¸«à¸¡à¸” ZeroSetup à¸‚à¸­à¸‡ `run-local.ps1` à¹€à¸£à¸µà¸¢à¸ `npm run db:migrate` à¸‹à¸¶à¹ˆà¸‡à¹ƒà¸Šà¹‰ postgres-js + `--env-file=.env` â†’ **à¹„à¸¡à¹ˆà¸¡à¸µà¸œà¸¥à¸à¸±à¸š PGlite à¹€à¸¥à¸¢** â€” PGlite à¹€à¸›à¸¥à¹ˆà¸²à¸ˆà¸°à¹„à¸¡à¹ˆà¸¡à¸µ schema (à¹€à¸”à¸´à¸¡à¸žà¸­à¸–à¸¹à¹„à¸–à¹„à¸”à¹‰à¹€à¸žà¸£à¸²à¸° `ensure-tables.ts` à¸ªà¸£à¹‰à¸²à¸‡à¸•à¸²à¸£à¸²à¸‡à¹€à¸à¸¡à¸•à¸­à¸™ runtime à¸‹à¸¶à¹ˆà¸‡à¸–à¸¹à¸à¸¥à¸šà¹à¸¥à¹‰à¸§) à¸„à¸§à¸£à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¸±à¹‰à¸™à¸•à¸­à¸™ push schema à¸¥à¸‡ pglite à¹ƒà¸™à¸ªà¸„à¸£à¸´à¸›à¸•à¹Œ (à¸šà¸±à¸™à¸—à¸¶à¸à¹€à¸žà¸´à¹ˆà¸¡à¹ƒà¸™ US-FIX-20i à¸«à¸£à¸·à¸­à¹à¸à¹‰ script)

## ðŸ›  Technical Tasks (à¸‡à¸²à¸™à¸žà¸±à¸’à¸™à¸²à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³)
- [ ] à¹€à¸‚à¸µà¸¢à¸™ `gameRooms` table à¹ƒà¸™ schema.ts: `id (uuid pk)`, `roomCode`, `gameType`, `hostId (fk users, cascade)`, `guestId (fk users, cascade, nullable)`, `gameState (jsonb)`, `currentTurn (int, default 1)`, `status (default 'waiting')`, `winnerId (fk users, set null)`, `finishReason`, `turnDeadline`, `expiresAt`, `createdAt`, `updatedAt`
- [ ] à¹€à¸‚à¸µà¸¢à¸™ `webrtcSignals` table: `id (uuid pk)`, `roomId (fk game_rooms, cascade)`, `role`, `sdpOffer`, `sdpAnswer`, `iceCandidates (jsonb, default [])`, `updatedAt` + unique index `(roomId, role)`
- [ ] à¹€à¸‚à¸µà¸¢à¸™ `gameStats` table: `id (uuid pk)`, `userId (fk users, cascade)`, `gameType`, `wins/losses/draws/winStreak/bestStreak/totalGames (int, default 0)`, `lastPlayedAt` + unique index `(userId, gameType)`
- [ ] à¹€à¸žà¸´à¹ˆà¸¡ relations à¹ƒà¸«à¹‰ query à¹à¸šà¸š `with: { host, guest, user }` à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹„à¸”à¹‰
- [ ] à¸£à¸±à¸™ `npm run db:generate` à¹à¸¥à¸°à¸•à¸£à¸§à¸ˆ SQL à¸—à¸µà¹ˆà¹„à¸”à¹‰à¸§à¹ˆà¸² idempotent/non-destructive
- [ ] à¸¥à¸š import + à¸à¸²à¸£à¹€à¸£à¸µà¸¢à¸ `ensureGameTables()` à¸—à¸±à¹‰à¸‡ 10 routes à¹à¸¥à¹‰à¸§à¸¥à¸šà¹„à¸Ÿà¸¥à¹Œ `src/db/ensure-tables.ts`
- [ ] à¸£à¸±à¸™ typecheck / lint / build / vitest à¹à¸¥à¸°à¸—à¸”à¸ªà¸­à¸š flow à¸ªà¸£à¹‰à¸²à¸‡à¸«à¹‰à¸­à¸‡â†’à¹€à¸¥à¹ˆà¸™â†’à¸ˆà¸šà¹€à¸à¸¡ à¸šà¸™ local DB

## ðŸ”— Related Files
- Report: [Recheck Report 2026-07-02](../../report/2026-07-02-p2p-game-recheck.md) (FIX-1, FIX-3)
- Schema: `src/db/schema.ts`, `src/db/ensure-tables.ts` (à¸ˆà¸°à¸–à¸¹à¸à¸¥à¸š)
- Routes: `src/app/api/battle/**/route.ts`
- Deploy policy: `/safe-deploy` skill, `.claude/agents` drizzle-migration-author

