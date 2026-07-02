# User Story: US-FIX-20e - à¸›à¹‰à¸­à¸‡à¸à¸±à¸™ Race Condition à¹ƒà¸™à¸à¸²à¸£à¹€à¸”à¸´à¸™à¸«à¸¡à¸²à¸à¹à¸¥à¸°à¸à¸²à¸£à¸ˆà¸šà¹€à¸à¸¡ (Idempotent Finalize + Atomic Stats)

**Status:** ðŸ” Implemented â€” In Review (à¸žà¸±à¸’à¸™à¸²à¹€à¸ªà¸£à¹‡à¸ˆ 2026-07-02, à¸—à¸”à¸ªà¸­à¸š local à¹à¸¥à¹‰à¸§)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../../report/2026-07-02-p2p-game-recheck.md)
**Priority:** ðŸŸ  Moderate â€” à¸‚à¸¶à¹‰à¸™à¸à¸±à¸š US-FIX-20a
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## ðŸ“– Description
**à¹ƒà¸™à¸à¸²à¸™à¸°** à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™à¹€à¸à¸¡ P2P Battle
**à¸‰à¸±à¸™à¸•à¹‰à¸­à¸‡à¸à¸²à¸£** à¹ƒà¸«à¹‰à¸œà¸¥à¹à¸žà¹‰/à¸Šà¸™à¸°/à¹€à¸ªà¸¡à¸­à¹à¸¥à¸°à¸ªà¸–à¸´à¸•à¸´ (win/loss/streak) à¸–à¸¹à¸à¸šà¸±à¸™à¸—à¸¶à¸à¸–à¸¹à¸à¸•à¹‰à¸­à¸‡à¹€à¸ªà¸¡à¸­ à¹à¸¡à¹‰à¸¡à¸µ request à¸¢à¸´à¸‡à¸‹à¹‰à¸­à¸™à¸à¸±à¸™ (double click, poll à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡à¸žà¸£à¹‰à¸­à¸¡à¸à¸±à¸™, network retry)
**à¹€à¸žà¸·à¹ˆà¸­à¹ƒà¸«à¹‰** leaderboard à¹à¸¥à¸°à¸›à¸£à¸°à¸§à¸±à¸•à¸´à¸à¸²à¸£à¹€à¸¥à¹ˆà¸™à¹€à¸Šà¸·à¹ˆà¸­à¸–à¸·à¸­à¹„à¸”à¹‰ à¹„à¸¡à¹ˆà¸¡à¸µà¸à¸²à¸£à¸™à¸±à¸šà¸‹à¹‰à¸³à¸«à¸£à¸·à¸­à¸«à¸¡à¸²à¸à¸–à¸¹à¸à¹€à¸‚à¸µà¸¢à¸™à¸—à¸±à¸š

## ðŸ› à¸—à¸µà¹ˆà¸¡à¸²à¸‚à¸­à¸‡à¸›à¸±à¸à¸«à¸² (à¸ˆà¸²à¸ Recheck Report â€” FIX-6)
1. `POST /move` à¸­à¹ˆà¸²à¸™ room à¹à¸¥à¹‰à¸§ update à¹‚à¸”à¸¢à¹„à¸¡à¹ˆà¸¡à¸µà¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚ concurrency â€” à¸ªà¸­à¸‡ request à¸—à¸µà¹ˆà¸­à¹ˆà¸²à¸™ state à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™à¸ˆà¸°à¹€à¸‚à¸µà¸¢à¸™à¸—à¸±à¸šà¸à¸±à¸™ (last-write-wins) â†’ à¸«à¸¡à¸²à¸à¸«à¸²à¸¢/turn à¹€à¸žà¸µà¹‰à¸¢à¸™
2. Lazy forfeit à¸­à¸¢à¸¹à¹ˆà¸—à¸±à¹‰à¸‡à¹ƒà¸™ `GET /state` (poll à¸—à¸¸à¸ 2 à¸§à¸´à¸ˆà¸²à¸à¸œà¸¹à¹‰à¹€à¸¥à¹ˆà¸™à¸—à¸±à¹‰à¸‡à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡) à¹à¸¥à¸° `POST /move` â†’ `finalizeGameInDb` à¸–à¸¹à¸à¹€à¸£à¸µà¸¢à¸à¸‹à¹‰à¸³à¸žà¸£à¹‰à¸­à¸¡à¸à¸±à¸™à¹„à¸”à¹‰
3. `updatePlayerStats` à¹ƒà¸™ `stats-helper.ts` à¹€à¸›à¹‡à¸™ read-modify-write (findFirst â†’ à¸„à¸³à¸™à¸§à¸“ â†’ update) à¹„à¸¡à¹ˆà¸¡à¸µ atomic increment â†’ à¸™à¸±à¸šà¸ªà¸–à¸´à¸•à¸´à¸‹à¹‰à¸³à¹€à¸¡à¸·à¹ˆà¸­ finalize à¸Šà¸™à¸à¸±à¸™

---

## âœ… Acceptance Criteria
1. [x] à¸à¸²à¸£ update à¸«à¸¡à¸²à¸à¹ƒà¸Šà¹‰ optimistic concurrency: `UPDATE ... WHERE id = :id AND status = 'active' AND current_turn = :expected` à¹à¸¥à¸°à¹€à¸Šà¹‡à¸„ affected rows â€” à¸–à¹‰à¸² 0 à¹à¸–à¸§à¹ƒà¸«à¹‰à¸•à¸­à¸š 409/400 à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¹€à¸‚à¸µà¸¢à¸™à¸—à¸±à¸š
2. [x] `finalizeGameInDb` à¹€à¸›à¹‡à¸™ idempotent: à¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚ `WHERE status = 'active'` (à¸«à¸£à¸·à¸­à¹€à¸—à¸µà¸¢à¸šà¹€à¸—à¹ˆà¸²) â€” à¹€à¸£à¸µà¸¢à¸à¸‹à¹‰à¸³à¸à¸µà¹ˆà¸„à¸£à¸±à¹‰à¸‡à¸ªà¸–à¸´à¸•à¸´à¸à¹‡à¸–à¸¹à¸ update à¹€à¸žà¸µà¸¢à¸‡à¸„à¸£à¸±à¹‰à¸‡à¹€à¸”à¸µà¸¢à¸§
3. [x] `updatePlayerStats` à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¹€à¸›à¹‡à¸™ upsert (`INSERT ... ON CONFLICT (user_id, game_type) DO UPDATE`) à¸žà¸£à¹‰à¸­à¸¡ atomic increment (`wins = game_stats.wins + 1` à¸¯à¸¥à¸¯) à¹ƒà¸™ statement à¹€à¸”à¸µà¸¢à¸§
4. [x] à¸¢à¸´à¸‡ `POST /move` à¸‹à¹‰à¸­à¸™à¸à¸±à¸™ 2 request (turn à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™) â†’ à¸ªà¸³à¹€à¸£à¹‡à¸ˆà¹€à¸žà¸µà¸¢à¸‡ 1, à¸­à¸µà¸à¸­à¸±à¸™à¹„à¸”à¹‰ error à¸Šà¸±à¸”à¹€à¸ˆà¸™; board à¹ƒà¸™ DB à¸ªà¸­à¸”à¸„à¸¥à¹‰à¸­à¸‡à¸à¸±à¸š move à¸—à¸µà¹ˆà¸ªà¸³à¹€à¸£à¹‡à¸ˆ
5. [x] à¸ˆà¸³à¸¥à¸­à¸‡ forfeit à¸”à¹‰à¸§à¸¢ poll `GET /state` à¸žà¸£à¹‰à¸­à¸¡à¸à¸±à¸™à¸ªà¸­à¸‡à¸à¸±à¹ˆà¸‡ â†’ à¸ªà¸–à¸´à¸•à¸´ win/loss à¹€à¸žà¸´à¹ˆà¸¡à¸‚à¸¶à¹‰à¸™à¸à¸±à¹ˆà¸‡à¸¥à¸° 1 à¹€à¸—à¹ˆà¸²à¸™à¸±à¹‰à¸™ (à¹„à¸¡à¹ˆà¸™à¸±à¸šà¸‹à¹‰à¸³)
6. [x] à¸¡à¸µ unit test à¸„à¸£à¸­à¸š `updatePlayerStats` (upsert/increment) à¹à¸¥à¸° integration test à¸ªà¸³à¸«à¸£à¸±à¸š move à¸—à¸µà¹ˆà¸Šà¸™à¸à¸±à¸™ (à¸£à¸±à¸™à¸šà¸™ local DB)

## ðŸ›  Technical Tasks (à¸‡à¸²à¸™à¸žà¸±à¸’à¸™à¸²à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸—à¸³)
- [x] à¹à¸à¹‰ `POST /move`: à¸£à¸§à¸¡à¹€à¸Šà¹‡à¸„ turn + apply move à¹€à¸›à¹‡à¸™ conditional UPDATE à¹€à¸”à¸µà¸¢à¸§, à¸­à¹ˆà¸²à¸™ affected rows à¸œà¹ˆà¸²à¸™ `.returning()`
- [x] à¹à¸à¹‰ `finalizeGameInDb` à¹ƒà¸™ `src/lib/games/stats-helper.ts`: update room à¹à¸šà¸šà¸¡à¸µà¹€à¸‡à¸·à¹ˆà¸­à¸™à¹„à¸‚ status à¹à¸¥à¸° **à¸‚à¹‰à¸²à¸¡** à¸à¸²à¸£à¸­à¸±à¸›à¹€à¸”à¸• stats à¹€à¸¡à¸·à¹ˆà¸­à¹„à¸¡à¹ˆà¸¡à¸µà¹à¸–à¸§à¸–à¸¹à¸à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™
- [x] à¹€à¸‚à¸µà¸¢à¸™ `updatePlayerStats` à¹ƒà¸«à¸¡à¹ˆà¹€à¸›à¹‡à¸™ single upsert + atomic increments (à¸„à¸³à¸™à¸§à¸“ `win_streak`/`best_streak` à¹ƒà¸™ SQL expression)
- [x] à¸•à¸£à¸§à¸ˆà¸ˆà¸¸à¸”à¹€à¸£à¸µà¸¢à¸ lazy-forfeit à¹ƒà¸™ `GET /state` à¹à¸¥à¸° `POST /move` à¹ƒà¸«à¹‰à¹ƒà¸Šà¹‰ path à¸—à¸µà¹ˆ idempotent à¹€à¸”à¸µà¸¢à¸§à¸à¸±à¸™
- [x] à¹€à¸žà¸´à¹ˆà¸¡ tests à¸•à¸²à¸¡ AC à¸‚à¹‰à¸­ 6 (vitest + local DB)

## ðŸ”— Related Files
- Report: [Recheck Report 2026-07-02](../../report/2026-07-02-p2p-game-recheck.md) (FIX-6)
- Code: `src/app/api/battle/rooms/[code]/move/route.ts`, `src/app/api/battle/rooms/[code]/state/route.ts`, `src/app/api/battle/rooms/[code]/resign/route.ts`, `src/lib/games/stats-helper.ts`

