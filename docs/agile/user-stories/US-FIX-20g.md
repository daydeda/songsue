# User Story: US-FIX-20g - ลดภาระ Polling ของหน้าเกมให้เข้ากับข้อจำกัด Free-tier

**Status:** 📝 Planned (รอพัฒนา)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🟠 Moderate — ขึ้นกับ US-FIX-20c (WebRTC ต้องคงการเชื่อมต่อได้ก่อน)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้ดูแลระบบ (ที่ต้องรองรับผู้ใช้ 400–500 คนพร้อมกันช่วง event บน Supabase free + Vercel Hobby)
**ฉันต้องการ** ให้หน้าเกมลดจำนวน request ต่อวินาทีลงอย่างมีนัยสำคัญ โดยเฉพาะเมื่อ WebRTC ต่อสำเร็จแล้ว
**เพื่อให้** feature เกมไม่ดึง connection ของ transaction pooler ไปจากระบบหลัก (scan-in, dashboard) ซึ่งเป็น pattern เดิมที่เคยก่อ 504 ทั้งเว็บมาแล้ว

## 🐛 ที่มาของปัญหา (จาก Recheck Report — FIX-8)
1. `RoomClient.tsx` poll `GET /state` ทุก 2 วินาที + signaling poll ทุก 1 วินาที **ต่อผู้เล่นหนึ่งคน** — ห้องเดียว = ~1.5 req/s; หลายสิบห้องช่วง event = หลายสิบ req/s ของ serverless invocation + DB query
2. State poll **ยังคงวิ่งต่อแม้ data channel ต่อสำเร็จแล้ว** — จ่ายต้นทุน P2P แต่ไม่ได้ลด load ฝั่ง server
3. กติกา free-tier ของโปรเจค: student-facing polls ≥ 60 วิ, polled query ต้อง O(1) และจำนวนต่ำ

---

## ✅ Acceptance Criteria
1. [ ] เมื่อ `connType === "webrtc"` state poll ผ่อนลงเหลืออย่างมาก 1 ครั้ง/30 วิ (ใช้เป็น reconciliation กับ server เท่านั้น) หรือหยุดจนกว่า channel จะหลุด
2. [ ] Signaling poll (1 วิ) **หยุดทันที**เมื่อ data channel เปิดสำเร็จ และกลับมาเฉพาะตอน renegotiate
3. [ ] โหมด fallback (ไม่มี WebRTC) poll ไม่ถี่กว่า 5 วินาที และหยุดสนิทเมื่อห้อง `finished`/`expired` หรือ tab ไม่ active (`document.visibilityState`)
4. [ ] Endpoint ที่ถูก poll ยังเป็น O(1) ต่อ query (indexed lookup — เป็นอยู่แล้ว ห้าม regress)
5. [ ] วัดผลก่อน/หลังบน local: จำนวน request ต่อนาทีต่อห้องขณะเล่นผ่าน WebRTC ลดลง ≥ 80% และเกมยังเล่นได้ลื่นทั้งสองโหมด

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] เพิ่ม logic ปรับ interval ตาม `connType` ใน `RoomClient.tsx` (webrtc → 30 วิ/หยุด, polling → 5 วิ)
- [ ] เคลียร์ `signalPollInterval` เมื่อ `dc.onopen` และตั้งใหม่เฉพาะเมื่อต้อง renegotiate
- [ ] เพิ่ม visibility handling: หยุด poll เมื่อ tab hidden, resume เมื่อกลับมา
- [ ] ส่งข้อมูล turn deadline ผ่าน data channel ด้วย เพื่อลดการพึ่ง state poll ระหว่างเกม
- [ ] วัดและบันทึกตัวเลข request/นาที ก่อน-หลังลง PR

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../report/2026-07-02-p2p-game-recheck.md) (FIX-8)
- Code: `src/app/battle/room/[code]/RoomClient.tsx`
- บริบท free-tier: `.claude/skills/recheck/SKILL.md` (หัวข้อ 4b), เหตุการณ์ 504 ในอดีตของ `/api/admin/events`
