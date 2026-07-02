# User Story: US-FIX-20e - ป้องกัน Race Condition ในการเดินหมากและการจบเกม (Idempotent Finalize + Atomic Stats)

**Status:** 🔍 Implemented — In Review (พัฒนาเสร็จ 2026-07-02, ทดสอบ local แล้ว)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🟠 Moderate — ขึ้นกับ US-FIX-20a
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้เล่นเกม P2P Battle
**ฉันต้องการ** ให้ผลแพ้/ชนะ/เสมอและสถิติ (win/loss/streak) ถูกบันทึกถูกต้องเสมอ แม้มี request ยิงซ้อนกัน (double click, poll สองฝั่งพร้อมกัน, network retry)
**เพื่อให้** leaderboard และประวัติการเล่นเชื่อถือได้ ไม่มีการนับซ้ำหรือหมากถูกเขียนทับ

## 🐛 ที่มาของปัญหา (จาก Recheck Report — FIX-6)
1. `POST /move` อ่าน room แล้ว update โดยไม่มีเงื่อนไข concurrency — สอง request ที่อ่าน state เดียวกันจะเขียนทับกัน (last-write-wins) → หมากหาย/turn เพี้ยน
2. Lazy forfeit อยู่ทั้งใน `GET /state` (poll ทุก 2 วิจากผู้เล่นทั้งสองฝั่ง) และ `POST /move` → `finalizeGameInDb` ถูกเรียกซ้ำพร้อมกันได้
3. `updatePlayerStats` ใน `stats-helper.ts` เป็น read-modify-write (findFirst → คำนวณ → update) ไม่มี atomic increment → นับสถิติซ้ำเมื่อ finalize ชนกัน

---

## ✅ Acceptance Criteria
1. [x] การ update หมากใช้ optimistic concurrency: `UPDATE ... WHERE id = :id AND status = 'active' AND current_turn = :expected` และเช็ค affected rows — ถ้า 0 แถวให้ตอบ 409/400 ไม่ใช่เขียนทับ
2. [x] `finalizeGameInDb` เป็น idempotent: เงื่อนไข `WHERE status = 'active'` (หรือเทียบเท่า) — เรียกซ้ำกี่ครั้งสถิติก็ถูก update เพียงครั้งเดียว
3. [x] `updatePlayerStats` เปลี่ยนเป็น upsert (`INSERT ... ON CONFLICT (user_id, game_type) DO UPDATE`) พร้อม atomic increment (`wins = game_stats.wins + 1` ฯลฯ) ใน statement เดียว
4. [x] ยิง `POST /move` ซ้อนกัน 2 request (turn เดียวกัน) → สำเร็จเพียง 1, อีกอันได้ error ชัดเจน; board ใน DB สอดคล้องกับ move ที่สำเร็จ
5. [x] จำลอง forfeit ด้วย poll `GET /state` พร้อมกันสองฝั่ง → สถิติ win/loss เพิ่มขึ้นฝั่งละ 1 เท่านั้น (ไม่นับซ้ำ)
6. [x] มี unit test ครอบ `updatePlayerStats` (upsert/increment) และ integration test สำหรับ move ที่ชนกัน (รันบน local DB)

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] แก้ `POST /move`: รวมเช็ค turn + apply move เป็น conditional UPDATE เดียว, อ่าน affected rows ผ่าน `.returning()`
- [x] แก้ `finalizeGameInDb` ใน `src/lib/games/stats-helper.ts`: update room แบบมีเงื่อนไข status และ **ข้าม** การอัปเดต stats เมื่อไม่มีแถวถูกเปลี่ยน
- [x] เขียน `updatePlayerStats` ใหม่เป็น single upsert + atomic increments (คำนวณ `win_streak`/`best_streak` ใน SQL expression)
- [x] ตรวจจุดเรียก lazy-forfeit ใน `GET /state` และ `POST /move` ให้ใช้ path ที่ idempotent เดียวกัน
- [x] เพิ่ม tests ตาม AC ข้อ 6 (vitest + local DB)

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../../report/2026-07-02-p2p-game-recheck.md) (FIX-6)
- Code: `src/app/api/battle/rooms/[code]/move/route.ts`, `src/app/api/battle/rooms/[code]/state/route.ts`, `src/app/api/battle/rooms/[code]/resign/route.ts`, `src/lib/games/stats-helper.ts`
