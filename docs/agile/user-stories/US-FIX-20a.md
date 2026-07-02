# User Story: US-FIX-20a - เพิ่ม Database Schema + Migration ของตารางเกม และลบ Runtime DDL

**Status:** 🔍 Implemented — In Review (commit `65dd566`, ทดสอบ local แล้ว 2026-07-02)
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
1. [x] `src/db/schema.ts` มี table definitions ของ `game_rooms`, `webrtc_signals`, `game_stats` ครบทุก column ตรงตามที่ routes ใช้งาน (อ้างอิง DDL ใน `src/db/ensure-tables.ts` เดิมเป็น spec)
2. [x] มี relations ครบ: `gameRooms.host`, `gameRooms.guest` (→ users), `gameStats.user` (→ users), และ index/unique index เดิมทั้งหมด (`room_code`, `status`, `(room_id, role)`, `(user_id, game_type)`) — แถม `winner` relation และ reverse relations ฝั่ง users
3. [x] สร้าง migration แล้ว — path จริงคือ `src/db/migrate.ts` step 58 (idempotent ✓) ⚠️ **ข้อควรระวัง:** ไฟล์ `drizzle/0010_giant_dragon_lord.sql` ที่ generate มาไม่ idempotent (CREATE TABLE เปล่า) และพ่วง drift เก่า (`calendar_entries.recurrence`, `shop_variants.price_delta`) — เป็น snapshot bookkeeping เท่านั้น **ห้ามรันไฟล์นี้ตรงๆ กับ DB ที่มีของอยู่แล้ว**
4. [x] ลบ `src/db/ensure-tables.ts` และการเรียก `ensureGameTables()` ออกจากทุก route แล้ว (ตรวจด้วย grep = 0 จุด) + โบนัส: แก้ `cell as any` เป็น union type
5. [ ] `npx tsc --noEmit` ผ่าน ✓ (0 error), `npm run build` ผ่าน ✓, vitest ผ่าน ✓ — **`npm run lint` ยังไม่ผ่าน** (29 errors แต่อยู่ในไฟล์นอกขอบเขต 20a: `JoinClient.tsx`, `create/page.tsx`, `ox.test.ts`, `test-db.ts` และไฟล์เก่าบน main → ยกไปปิดใน [US-FIX-20i](US-FIX-20i.md))
6. [x] ทดสอบบน local แล้ว (2026-07-02) — ดูรายละเอียดในหัวข้อ "🧪 ผลการทดสอบ" ด้านล่าง

## 🧪 ผลการทดสอบ (2026-07-02, local PGlite — เครื่องไม่มี Docker)
- สร้าง PGlite DB สดจาก schema (`drizzle-kit push` driver pglite) + seed houses → ตาราง `game_rooms`/`webrtc_signals`/`game_stats` ถูกสร้างครบ
- รัน `next dev` (DB_TYPE=pglite) + login ผู้เล่น 2 คนผ่าน dev bypass → เล่นเกมเต็ม flow ผ่าน API:
  create room (`8WBQ`) → join → active → เดินหมากสลับกัน → host ชนะแนวนอน → `status=finished, reason=win` ✓
- กติกาถูก enforce ครบ: เดินผิดตา → `Not your turn` ✓, เดินช่องซ้ำ → `Illegal move` ✓, เดินหลังจบเกม → `Game is not active` ✓, ไม่ login → `401 Unauthorized` ✓
- สถิติถูกต้องไม่นับซ้ำ: host `W1 streak1 total1`, guest `L1 total1`; leaderboard join ข้อมูล user สำเร็จ ✓
- **ยังไม่ครอบคลุม:** (ก) WebRTC ระหว่าง 2 browser จริง (มี bug teardown อยู่แล้ว → [US-FIX-20c](US-FIX-20c.md)), (ข) rehearsal `migrate.ts` กับ Postgres จริง — เครื่องนี้ไม่มี Docker/Postgres; ต้อง rehearse ตาม `/safe-deploy` ก่อน deploy จริง
- **ช่องว่างที่พบระหว่างทดสอบ:** โหมด ZeroSetup ของ `run-local.ps1` เรียก `npm run db:migrate` ซึ่งใช้ postgres-js + `--env-file=.env` → **ไม่มีผลกับ PGlite เลย** — PGlite เปล่าจะไม่มี schema (เดิมพอถูไถได้เพราะ `ensure-tables.ts` สร้างตารางเกมตอน runtime ซึ่งถูกลบแล้ว) ควรเพิ่มขั้นตอน push schema ลง pglite ในสคริปต์ (บันทึกเพิ่มใน US-FIX-20i หรือแก้ script)

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
