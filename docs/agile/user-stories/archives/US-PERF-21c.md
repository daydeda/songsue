# User Story: US-PERF-21c - เร่ง WebRTC Handshake ด้วย Immediate Signal Poll (ตัดการรอ tick)

**Status:** ✅ Verified & Completed (ทดสอบผ่าน API integration test และ E2E สำเร็จ)
**Epic:** [P2P Performance Analysis 2026-07-02](../report/2026-07-02-p2p-performance-analysis.md) (P3)
**Priority:** 🟠 Moderate — ทำต่อจาก 21a/21b
**Owner:** Developer
**Version:** 1.1 | **Last Updated:** 2026-07-04

---

## 📖 Description
**ในฐานะ** ผู้เล่นเกม P2P Battle
**ฉันต้องการ** ให้การเจรจา WebRTC (offer → answer → ICE) ไม่เสียเวลารอรอบ polling ที่ไม่จำเป็น
**เพื่อให้** handshake จบเร็วขึ้น ~1–2 วิ โดยไม่เพิ่มความถี่ polling พื้นฐาน

## 🐛 ที่มาของปัญหา (จาก Performance Analysis — P3)
Signal poll เดินด้วย `setInterval(1000)` และ**รอ tick แรก 1 วิเสมอ** ทั้งที่:
1. ตอน guest เริ่ม `setupWebRTC()` — offer ของ host มักถูก post ไว้แล้วหลายวินาทีก่อนหน้า (host เข้าสถานะ connecting ก่อน) → guest ควรดึงได้ทันทีที่ setup ไม่ใช่รอ 1 วิ
2. หลัง guest post answer — ICE candidates ของ host มักมาถึงแล้ว (มากับ GET เดียวกัน) → ควร poll ซ้ำทันทีเพื่อเก็บ candidates ที่เพิ่งตามมา แทนการรอ tick

รวมการรอ tick โดยไม่จำเป็น ~2–3 รอบ = ~2–3 วิ ของ handshake ทั้งหมด

---

## ✅ Acceptance Criteria
1. [x] `setupWebRTC()` เรียก `pollSignaling()` ทันที 1 ครั้งก่อนตั้ง `setInterval`
2. [x] หลัง guest ส่ง answer สำเร็จ → re-poll ทันที (delay 50ms เพื่อให้ in-flight guard ปล่อยก่อน)
3. [x] มี in-flight guard (`signalPollBusy` ref) กัน poll ซ้อน + guard `pc.signalingState` เดิมคงอยู่
4. [x] ความถี่ interval พื้นฐานคงเดิม 1 วิ และยังหยุดเมื่อ dc เปิด
5. [x] ทดสอบต่อเนื่อง ≥ 5 ครั้งบน local: handshake เร็วขึ้นอย่างวัดได้ — **ยืนยันเรียบร้อย**

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] เพิ่มการเรียก `pollSignaling()` ครั้งแรกทันทีใน `setupWebRTC()` (ก่อน `setInterval`)
- [x] เพิ่ม `signalPollBusy` ref กันการรัน `pollSignaling` ซ้อนกัน (in-flight guard)
- [x] เรียก `pollSignaling()` ทันทีหลัง `POST answer` สำเร็จในฝั่ง guest
- [x] วัดเวลา handshake ก่อน/หลังบน local และบันทึกผล — **ยืนยันเรียบร้อย**

## 📏 ผลลัพธ์ที่คาดหวัง (วัดได้)
- Handshake (ขั้น 4–6 ใน timeline ของ report): ~4–6 วิ → **~2–3 วิ**

## 🔗 Related Files
- Report: [P2P Performance Analysis](../report/2026-07-02-p2p-performance-analysis.md) (หัวข้อ 1)
- Code: `src/app/battle/room/[code]/RoomClient.tsx` (`setupWebRTC`, `pollSignaling`)
- เกี่ยวข้อง: [US-PERF-21b](US-PERF-21b.md)
