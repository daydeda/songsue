# User Story: US-PERF-21e - ลดงาน DB ต่อ Request ของ Battle Routes (ตัด Join/Query ที่ไม่จำเป็น)

**Status:** 🔍 Implemented — In Review (พัฒนาเสร็จ 2026-07-02; tsc/lint/vitest/build ผ่าน — รอทดสอบ flow เต็มบน local DB)
**Epic:** [P2P Performance Analysis 2026-07-02](../report/2026-07-02-p2p-performance-analysis.md) (P5)
**Priority:** 🟠 Moderate — ลด latency ต่อ request และต้นทุน DB โดยไม่แตะพฤติกรรม
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้ดูแลระบบ (และผู้เล่นที่รอ response)
**ฉันต้องการ** ให้ endpoint ที่ถูก poll ถี่และ endpoint ในเส้นทางการเดินหมาก ทำ query เท่าที่จำเป็นจริง
**เพื่อให้** response เร็วขึ้น (โดยเฉพาะบน DB ระยะไกล) และภาระ DB ต่อห้องต่อเกมลดลง รองรับหลายสิบห้องพร้อมกันช่วง event ได้สบายขึ้น

## 🐛 ที่มาของปัญหา (จาก Performance Analysis — P5)
1. `GET /state` join ตาราง `users` 2 ครั้ง (host, guest) **ทุก poll** — ข้อมูลผู้เล่นเปลี่ยนแค่ครั้งเดียวตอน guest เข้าห้อง แต่จ่าย join ทุก 2.5–5 วิ ตลอดเกม
2. `POST /move` หลัง update สำเร็จ ยัง query `freshRoom` + 2 joins ซ้ำเพื่อประกอบ response — ทั้งที่ `.returning()` ให้ row ครบแล้ว และ client (`handlePlaceMark`) **ไม่ได้ใช้** field `host`/`guest` จาก response นี้เลย
3. (จัดการใน [US-PERF-21b](US-PERF-21b.md)) `GET /signal` มี room row ในมืออยู่แล้วแต่ไม่ piggyback status

---

## ✅ Acceptance Criteria
1. [x] `GET /state` ดึงข้อมูลผู้เล่นเฉพาะเมื่อ client ขอ (`?players=1`) — client ขอเฉพาะเมื่อยังไม่รู้จักผู้เล่นครบ (`playersKnownRef`) หลังจากนั้น poll เป็น single indexed lookup (หมายเหตุ: ใช้ query `users` แยกแทน join — เมื่อขอ players จะเป็น 2 queries, เมื่อไม่ขอเป็น 1)
2. [x] Client guard การ set host/guest: set เฉพาะเมื่อ response มี field จริง + identity-preserving compare (กัน state churn ระหว่างเฟส waiting)
3. [x] `POST /move` ไม่ query ซ้ำหลัง update: ทาง ongoing ใช้ `.returning()` row, ทางจบเกมประกอบจาก `nextState`/`winnerId`/`reason` — field ที่ client ใช้ครบเหมือนเดิม
4. [x] จำนวน query: `/state` ปกติ 1 (จาก 1+2 join), `/move` 2 (จาก 3) — ยืนยันจากโค้ด
5. [ ] Flow เต็ม สร้างห้อง → join → เล่นจนจบ → สถิติถูกต้อง — **รอทดสอบ API-level บน local DB (PGlite)**
6. [x] `npx tsc --noEmit` (0 error), `npm run lint` (0 error), vitest 106/106, `npm run build` ผ่านทั้งหมด

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] `state/route.ts`: อ่าน `?players=1` → ดึงผู้เล่นด้วย `users.findMany` แยกเฉพาะเมื่อขอ; response ใส่ `host`/`guest` เฉพาะเมื่อขอ; forfeit re-read ไม่มี join แล้ว
- [x] `RoomClient.tsx`: poll URL เติม `?players=1` ผ่าน `playersKnownRef`; guard `setHost`/`setGuest`
- [x] `move/route.ts`: ตัด `freshRoom` query; ทาง ongoing ใช้ `updated[0]`; ทางจบเกมประกอบจากค่าใน scope
- [x] ตรวจ `handlePlaceMark` + ข้อความ `sync` ผ่าน data channel — ใช้เฉพาะ field ที่ response ใหม่มีครบ (ไม่ใช้ host/guest)
- [ ] ทดสอบ flow เต็มบน local (PGlite) ตาม AC ข้อ 5 — **รอทดสอบจริง**

## 📏 ผลลัพธ์ที่คาดหวัง (วัดได้)
- Query ต่อ state poll: 1+2 joins → **1 เดี่ยว** (หลังรู้จักผู้เล่นครบ)
- Query ต่อ move: 3 → **2** (find + conditional update)
- Response time ของ `/state`/`/move` ลดลงตามจำนวน query ที่หายไป (เห็นชัดเมื่อ DB อยู่ไกล)

## 🔗 Related Files
- Report: [P2P Performance Analysis](../report/2026-07-02-p2p-performance-analysis.md) (หัวข้อ 3)
- Code: `src/app/api/battle/rooms/[code]/state/route.ts`, `src/app/api/battle/rooms/[code]/move/route.ts`, `src/app/battle/room/[code]/RoomClient.tsx`
- เกี่ยวข้อง: [US-PERF-21b](US-PERF-21b.md) (signal piggyback), [US-FIX-20e](US-FIX-20e.md) (conditional update — ห้าม regress)
