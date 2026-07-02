# User Story: US-PERF-21b - เร่งช่วง Pre-game (waiting → connecting → active) ด้วย Phase-aware Polling + Status Piggyback

**Status:** 🔍 Implemented — In Review (พัฒนาเสร็จ 2026-07-02; tsc/lint/vitest/build ผ่าน — รอวัดผลจริง 2 browser)
**Epic:** [P2P Performance Analysis 2026-07-02](../report/2026-07-02-p2p-performance-analysis.md) (P2)
**Priority:** 🔴 Crucial — จุดที่ผู้เล่น "รู้สึกช้า" ชัดที่สุด
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้เล่นเกม P2P Battle
**ฉันต้องการ** ให้ช่วงจับคู่ (host รอ guest, สร้างการเชื่อมต่อ, เปลี่ยนเป็น active) ตอบสนองภายใน ~1–2 วิ ต่อขั้น
**เพื่อให้** เวลารวมจากกด join จนเห็นกระดานสั้นลงจาก ~7–11 วิ เหลือ ~3–5 วิ

## 🐛 ที่มาของปัญหา (จาก Performance Analysis — P2)
1. ระหว่างสถานะ `waiting`/`connecting` client ใช้ state poll interval เดียวกับตอนเล่น (5 วิ) — host จึงรู้ว่า guest เข้าห้องช้าสุด 5 วิ ทั้งที่ช่วง pre-game สั้นและมีห้องพร้อมกันไม่มาก (ห้องหมดอายุใน 10 นาที) — การ poll ถี่ขึ้น*เฉพาะช่วงนี้*แทบไม่กระทบ request budget รวม
2. `GET /signal` ถูก poll ทุก 1 วิระหว่าง handshake อยู่แล้ว และ server ก็ query ห้องมาเช็คสิทธิ์ทุกครั้ง แต่**ไม่ส่ง `room.status` กลับ** — client ต้องรอ state poll แยกอีกช่องทางเพื่อรู้ว่าห้อง `active` แล้ว

---

## ✅ Acceptance Criteria
1. [x] State poll ปรับ interval ตามเฟส: `waiting`/`connecting` = **2 วิ**, `active` + polling = ตาม [US-PERF-21d](US-PERF-21d.md) (turn-aware ทำพร้อมกันแล้ว), `active` + webrtc = 30 วิ, `finished`/`expired`/tab hidden = หยุด
2. [x] `GET /signal` ตอบ field `roomStatus` โดยไม่เพิ่ม query (ใช้ room row ที่ query เพื่อเช็คสิทธิ์อยู่แล้ว)
3. [x] Client อัปเดตสถานะจาก `roomStatus` ใน `pollSignaling()` (guard identity — set เฉพาะเมื่อเปลี่ยนจริง, ข้ามค่า `waiting`)
4. [ ] Host เห็นว่า guest เข้าห้องภายใน ≤ 2 วิ — **รอวัดจริง** (เชิงโค้ด: poll waiting = 2 วิ)
5. [x] Request budget: จ่ายเพิ่มเฉพาะเฟส pre-game (สั้น, มีเพดานห้องหมดอายุ 10 นาที); ชดเชยด้วย /state ที่เบาลงจาก [US-PERF-21e](US-PERF-21e.md)
6. [ ] เวลา join → เห็นกระดาน (WebRTC สำเร็จ): ≤ ~5 วิ — **รอวัดจริงบน local 2 browser**

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] แก้สูตร `intervalMs` ใน state-poll effect ของ `RoomClient.tsx` ให้ขึ้นกับ `status` ก่อน `connType`
- [x] เพิ่ม `roomStatus: room.status` ใน response ของ `GET /api/battle/rooms/[code]/signal`
- [x] ใน `pollSignaling()` ฝั่ง client: ถ้า `data.roomStatus` เปลี่ยนจาก state ปัจจุบัน → `setStatus(data.roomStatus)`
- [x] Orchestrator effect ปลอดภัยเมื่อ status มาจาก signal poll (guard `!webrtcActive.current && !pcRef.current` เดิม)
- [ ] วัดเวลา join→board ก่อน/หลัง บน local (2 browser) และบันทึกใน story/PR — **รอทดสอบจริง**

## 📏 ผลลัพธ์ที่คาดหวัง (วัดได้)
- Host รู้ว่า guest เข้า: แย่สุด 5 วิ → **2 วิ**
- ทั้งคู่เห็น `active` หลัง markRoomActive: แย่สุด ~5 วิ → **≤ 1 วิ** (ผ่าน signal poll)
- Join → เห็นกระดาน (P2P สำเร็จ): ~7–11 วิ → **~3–5 วิ**

## 🔗 Related Files
- Report: [P2P Performance Analysis](../report/2026-07-02-p2p-performance-analysis.md) (หัวข้อ 1, 3)
- Code: `src/app/battle/room/[code]/RoomClient.tsx`, `src/app/api/battle/rooms/[code]/signal/route.ts`
- เกี่ยวข้อง: [US-FIX-20g](US-FIX-20g.md) (กติกา polling เดิม), [US-PERF-21c](US-PERF-21c.md), [US-PERF-21d](US-PERF-21d.md)
