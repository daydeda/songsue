# User Story: US-FIX-20i - Low-priority Hardening Bundle ของ P2P Game (Rate Limit, Audit Volume, Types, Privacy Note)

**Status:** 📝 Planned (รอพัฒนา)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🟡 Low — ทำหลัง story อื่นใน epic เสร็จ (ขึ้นกับ US-FIX-20a)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** นักพัฒนาระบบ
**ฉันต้องการ** เก็บงานปรับปรุงย่อยที่เหลือของ feature P2P game (ความปลอดภัยเชิงลึก, ปริมาณ audit log, type safety, privacy)
**เพื่อให้** feature มีคุณภาพระดับเดียวกับส่วนอื่นของโปรเจคก่อนเปิดใช้จริงในงาน event

## 🐛 ที่มาของปัญหา (จาก Recheck Report — L1–L5)

| # | ประเด็น |
|---|---|
| L1 | Room code 4 ตัวอักษร (~1M แบบ) — user ที่ login แล้ว brute-force endpoint `join`/`GET room` ได้ ไม่มี rate limit (และ `src/lib/rate-limit.ts` เป็น per-instance บน serverless) |
| L2 | WebRTC แลก IP address ระหว่างผู้เล่นผ่าน ICE — ธรรมชาติของ P2P แต่ควรแจ้งผู้ใช้ |
| L3 | ทุก action ของเกม (สร้างห้อง/join/จบเกม/ยอมแพ้) เขียนลง `audit_logs` ซึ่งเป็น tamper-evident hash chain สำหรับงาน compliance — volume เกมจะบวมเร็วและปน noise เข้า chain |
| L4 | Types หลวม: `tx: any` ใน `stats-helper.ts`, `cell as any` ใน `move/route.ts`, พารามิเตอร์ `currentTurn` ใน `validateMove` ไม่ถูกใช้ |
| L5 | `GET /stats/me` คืน default stats object ปลอม (`id: ""`, `lastPlayedAt: new Date()`) ทั้งที่ผู้ใช้ไม่เคยเล่น |

---

## ✅ Acceptance Criteria
1. [ ] Endpoint `POST /rooms/[code]/join` และ `GET /rooms/[code]` มี rate limit ต่อ user (เช่น 10 ครั้ง/นาที) — ยอมรับข้อจำกัด per-instance และระบุไว้ใน comment
2. [ ] หน้า lobby/join มีข้อความแจ้งสั้นๆ ว่าการเล่นแบบ P2P มีการแลกเปลี่ยน network address ระหว่างผู้เล่นสองฝั่ง (4 ภาษา EN/TH/MM/CN ผ่าน i18n)
3. [ ] ตัดสินใจเรื่อง audit log ของเกมร่วมกับทีม: ย้ายไป log ธรรมดา (`captureException`/console) หรือคงไว้เฉพาะ event สร้างห้องและจบเกม — บันทึกข้อสรุปใน doc
4. [ ] `tx` ใน `stats-helper.ts` มี type ถูกต้อง (transaction type ของ drizzle), ตัด `as any`, ลบพารามิเตอร์ที่ไม่ใช้ใน `validateMove` (หรือใช้งานจริง)
5. [ ] `GET /stats/me` คืน `stats: null` เมื่อไม่เคยเล่น และ client (`BattleHubClient.tsx`) แสดงสถานะ "ยังไม่เคยเล่น" ถูกต้อง
6. [ ] `npx tsc --noEmit`, `npm run lint`, unit tests ผ่านทั้งหมด

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] ผูก `src/lib/rate-limit.ts` เข้ากับ join/room-lookup endpoints
- [ ] เพิ่มคีย์ i18n ใน `src/lib/i18n.ts` (ครบ 4 ภาษา) สำหรับ privacy note + แสดงใน `JoinClient.tsx` / `RoomClient.tsx`
- [ ] ปรับการเรียก `AuditService.logAction` ในเกมตามข้อสรุปข้อ 3
- [ ] Type cleanup ใน `stats-helper.ts`, `ox.ts`, `move/route.ts`
- [ ] แก้ `stats/me/route.ts` + การ render ของ `BattleHubClient.tsx`

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../../report/2026-07-02-p2p-game-recheck.md) (L1–L5)
- Code: `src/app/api/battle/**`, `src/lib/games/*`, `src/lib/rate-limit.ts`, `src/lib/i18n.ts`, `src/app/battle/*`
