# User Story: US-FIX-20f - Validate Signal Payload ด้วย Zod และล้างข้อมูลเกมเก่า

**Status:** 📝 Planned (รอพัฒนา)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🟠 Moderate — ขึ้นกับ US-FIX-20a
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้ดูแลระบบ
**ฉันต้องการ** ให้ endpoint signaling ตรวจสอบชนิด/ขนาดของ input ทุก field ตามมาตรฐานเดียวกับ route อื่นในโปรเจค (Zod) และมีการล้างข้อมูลห้อง/สัญญาณเก่าออกจากฐานข้อมูล
**เพื่อให้** ผู้ใช้ที่ login แล้วไม่สามารถยัด payload ขนาดใหญ่ลง jsonb ได้เรื่อยๆ และตาราง `game_rooms` / `webrtc_signals` ไม่โตไม่จำกัดบน free tier

## 🐛 ที่มาของปัญหา (จาก Recheck Report — FIX-7)
1. `POST /signal` รับ `sdpOffer` / `sdpAnswer` / `iceCandidates` โดยไม่ validate ชนิดและไม่จำกัดขนาดเลย (route อื่นของโปรเจคใช้ Zod ทั้งหมด)
2. ไม่มีการลบข้อมูลเก่า: ห้องที่จบ/หมดอายุและ signals ค้างอยู่ตลอดไป — ขัดกับข้อจำกัด storage ของ free tier และหลัก data minimization

---

## ✅ Acceptance Criteria
1. [ ] `POST /signal` มี Zod schema: `role` เป็น enum `["host","guest"]`, `sdpOffer`/`sdpAnswer` เป็น string ยาวไม่เกินเพดานที่กำหนด (เช่น 20,000 ตัวอักษร), ICE candidate มี field ที่คาดหวังและขนาดจำกัด — input ไม่ผ่านได้ 400 พร้อมรายละเอียด
2. [ ] `POST /rooms` และ `POST /move` ตรวจ body ด้วย Zod เช่นกัน (`gameType` enum, `cell` int 1–9)
3. [ ] เมื่อเกมจบ (`finished`) แถวใน `webrtc_signals` ของห้องนั้นถูกลบ (สัญญาณไม่จำเป็นอีกต่อไป)
4. [ ] มีกลไกล้างข้อมูลเก่า: ห้องสถานะ `expired`/`finished` ที่เก่ากว่าระยะเก็บที่กำหนด (เสนอ 30 วัน — ยืนยันกับทีมก่อน) ถูกลบผ่าน endpoint cron ที่มีอยู่ของโปรเจคหรือ script แยก — **ห้ามลบใน hot path ของ request ผู้เล่น**
5. [ ] การลบไม่กระทบ `game_stats` (สถิติสะสมคงอยู่) และไม่แตะ `audit_logs`
6. [ ] ทดสอบ: payload เกินเพดาน → 400, จบเกมแล้ว signals หาย, cron ลบเฉพาะห้องที่เข้าเกณฑ์

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] เขียน Zod schemas ใน route `signal`, `rooms`, `move` (ตามแบบ route อื่นในโปรเจค)
- [ ] เพิ่มการลบ `webrtc_signals` ของห้องใน `finalizeGameInDb` (ภายใน transaction เดียวกัน)
- [ ] เพิ่ม cleanup job: ผูกกับ cron endpoint เดิมของโปรเจค (เช่นเดียวกับ `/api/admin/award-check` pattern) ลบห้อง `expired`/`finished` เก่ากว่าเกณฑ์ + signals กำพร้า
- [ ] ระบุนโยบายอายุข้อมูลเกมใน doc (`docs/agile/report/2026-07-02-p2p-game-recheck.md` หรือ retention notes ของโปรเจค)
- [ ] ทดสอบทั้ง 3 กรณีตาม AC บน local DB

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../report/2026-07-02-p2p-game-recheck.md) (FIX-7)
- Code: `src/app/api/battle/rooms/[code]/signal/route.ts`, `src/app/api/battle/rooms/route.ts`, `src/app/api/battle/rooms/[code]/move/route.ts`, `src/lib/games/stats-helper.ts`
- เกี่ยวข้อง: [US-FIX-20d](US-FIX-20d.md) (รูปแบบ ICE payload ใหม่ต้องสอดคล้องกับ schema นี้)
