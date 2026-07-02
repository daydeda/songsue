# User Story: US-FIX-20a - เพิ่ม Database Schema + Migration ของตารางเกม และลบ Runtime DDL

**Status:** 📝 Planned (รอพัฒนา)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🔴 Crucial — **ต้องทำก่อน story อื่นทั้งหมดใน epic นี้**
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** นักพัฒนาระบบ
**ฉันต้องการ** ให้ตาราง `game_rooms`, `webrtc_signals`, `game_stats` ถูกประกาศใน Drizzle schema (`src/db/schema.ts`) พร้อม migration file ตามมาตรฐานโปรเจค แทนการสร้างตารางแบบ runtime ด้วย `ensureGameTables()`
**เพื่อให้** โปรเจค compile/build ผ่าน, ตารางถูกสร้างผ่าน migration ที่ review ได้ และไม่มีการรัน DDL จาก request path บน production

## 🐛 ที่มาของปัญหา (จาก Recheck Report)
1. ทุก route ใต้ `src/app/api/battle/` import `gameRooms` / `gameStats` / `webrtcSignals` จาก `@/db/schema` แต่ schema.ts **ไม่มีตารางเหล่านี้** → `npx tsc --noEmit` error 69 จุด, `npm run build` ไม่ผ่าน (FIX-1)
2. `src/db/ensure-tables.ts` รัน `CREATE TABLE IF NOT EXISTS` 6 คำสั่งจาก request path **ก่อน check auth**, กลืน error ทิ้ง และข้าม flow migration ของโปรเจค (FIX-3)

---

## ✅ Acceptance Criteria
1. [ ] `src/db/schema.ts` มี table definitions ของ `game_rooms`, `webrtc_signals`, `game_stats` ครบทุก column ตรงตามที่ routes ใช้งาน (อ้างอิง DDL ใน `src/db/ensure-tables.ts` เดิมเป็น spec)
2. [ ] มี relations ครบ: `gameRooms.host`, `gameRooms.guest` (→ users), `gameStats.user` (→ users), และ index/unique index เดิมทั้งหมด (`room_code`, `status`, `(room_id, role)`, `(user_id, game_type)`)
3. [ ] สร้าง migration ด้วย `npm run db:generate` — migration ต้อง idempotent และ non-destructive ตามนโยบาย `/safe-deploy` (ห้ามรัน `db:migrate` กับ prod เองโดยไม่ผ่าน flow)
4. [ ] ลบ `src/db/ensure-tables.ts` และการเรียก `ensureGameTables()` ออกจากทุก route (10 จุด)
5. [ ] `npx tsc --noEmit` ผ่าน (0 error), `npm run lint` ผ่าน, `npm run build` ผ่าน
6. [ ] ทดสอบ migration + สร้างห้อง/เล่นเกมจบ 1 เกมบน **local DB เท่านั้น** (ผ่าน `/db-local` หรือ `run-local.ps1`) — ห้ามแตะ production

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] เขียน `gameRooms` table ใน schema.ts: `id (uuid pk)`, `roomCode`, `gameType`, `hostId (fk users, cascade)`, `guestId (fk users, cascade, nullable)`, `gameState (jsonb)`, `currentTurn (int, default 1)`, `status (default 'waiting')`, `winnerId (fk users, set null)`, `finishReason`, `turnDeadline`, `expiresAt`, `createdAt`, `updatedAt`
- [ ] เขียน `webrtcSignals` table: `id (uuid pk)`, `roomId (fk game_rooms, cascade)`, `role`, `sdpOffer`, `sdpAnswer`, `iceCandidates (jsonb, default [])`, `updatedAt` + unique index `(roomId, role)`
- [ ] เขียน `gameStats` table: `id (uuid pk)`, `userId (fk users, cascade)`, `gameType`, `wins/losses/draws/winStreak/bestStreak/totalGames (int, default 0)`, `lastPlayedAt` + unique index `(userId, gameType)`
- [ ] เพิ่ม relations ให้ query แบบ `with: { host, guest, user }` ใช้งานได้
- [ ] รัน `npm run db:generate` และตรวจ SQL ที่ได้ว่า idempotent/non-destructive
- [ ] ลบ import + การเรียก `ensureGameTables()` ทั้ง 10 routes แล้วลบไฟล์ `src/db/ensure-tables.ts`
- [ ] รัน typecheck / lint / build / vitest และทดสอบ flow สร้างห้อง→เล่น→จบเกม บน local DB

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../report/2026-07-02-p2p-game-recheck.md) (FIX-1, FIX-3)
- Schema: `src/db/schema.ts`, `src/db/ensure-tables.ts` (จะถูกลบ)
- Routes: `src/app/api/battle/**/route.ts`
- Deploy policy: `/safe-deploy` skill, `.claude/agents` drizzle-migration-author
