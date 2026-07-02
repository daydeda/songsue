# User Story: US-PERF-21a - WebRTC Connect Timeout 10 วิ + รับประกันว่าเกมเริ่มได้เสมอแม้ P2P ล้มเหลว

**Status:** 🔍 Implemented — In Review (พัฒนาเสร็จ 2026-07-02; tsc/lint/vitest/build ผ่าน — รอทดสอบ E2E 2 browser)
**Epic:** [P2P Performance Analysis 2026-07-02](../report/2026-07-02-p2p-performance-analysis.md) (P1)
**Priority:** 🔴 Crucial — เป็น correctness bug ไม่ใช่แค่ optimization ต้องทำก่อนเรื่องอื่นใน epic
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้เล่นเกม P2P Battle ที่อยู่หลัง NAT/firewall ที่ WebRTC ผ่านไม่ได้
**ฉันต้องการ** ให้ระบบตรวจจับการเชื่อมต่อที่ล้มเหลวภายในเวลาที่แน่นอน (10 วินาที) แล้วสลับไปเล่นผ่าน HTTP polling โดยอัตโนมัติจริงตามที่ UI สัญญาไว้
**เพื่อให้** เกมเริ่มได้เสมอภายในเวลาที่คาดเดาได้ ไม่ติดค้างหน้า "กำลังตั้งค่าการเชื่อมต่อ P2P..." จนห้องหมดอายุ

## 🐛 ที่มาของปัญหา (จาก Performance Analysis — P1)
1. UI หน้า connecting ใน `RoomClient.tsx` แสดงข้อความว่าจะ fallback อัตโนมัติใน 10 วิ แต่**ไม่มี timer นี้ในโค้ด**
2. `markRoomActive()` (ตัวเปลี่ยนสถานะห้องเป็น `active`) ถูกเรียกเฉพาะเมื่อ WebRTC สำเร็จ (`pc.onconnectionstatechange === "connected"` และ `dc.onopen`) — เมื่อ ICE ล้มเหลว โค้ดแค่ `setConnType("polling")` แต่**ไม่มีใคร mark ห้อง active** → กระดานไม่ปรากฏทั้งสองฝั่ง
3. Browser ใช้เวลา 15–40 วิกว่าจะยิงสถานะ `failed` (ระหว่างนั้นค้าง `checking`) — ผู้เล่นเห็นแต่หน้ารอ

---

## ✅ Acceptance Criteria
1. [x] มี timer 10 วินาที (`webrtcTimeoutRef`) เริ่มนับเมื่อ `setupWebRTC()` เริ่มทำงาน — ถ้า data channel ยังไม่เปิดเมื่อครบเวลา: ปิด peer connection (`cleanupWebRTC`), ตั้ง `connType = "polling"`, และเรียก `markRoomActive()` เพื่อให้เกมเริ่มผ่าน REST
2. [x] Timer ถูกยกเลิกใน `dc.onopen`, `connectionState === "connected"` และใน `cleanupWebRTC()` (ครอบ unmount/จบเกมด้วย) — guard `!webrtcActive.current` กันยิงซ้ำหลังต่อสำเร็จ
3. [x] กรณี browser ยิง `connectionState === "failed"` ก่อนครบ 10 วิ → fallback + `markRoomActive()` ทันที (แยก branch `failed` ออกจาก `closed` — `closed` เกิดตอน cleanup ปกติ ไม่ mark active)
4. [x] `POST /active` ยังคง idempotent (ไม่ได้แก้ route นี้)
5. [ ] เวลาแย่สุดจากที่ guest กด join จนทั้งสองฝั่งเห็นกระดาน ≤ ~12 วิ ในกรณี WebRTC ล้มเหลวสนิท — **รอวัดจริงบน 2 browser** (เชิงโค้ด: 10 วิ timeout + signal/state poll ≤ 2 วิ)
6. [x] กรณี WebRTC สำเร็จตามปกติ พฤติกรรมเหมือนเดิม (path `connected`/`dc.onopen` ไม่เปลี่ยน นอกจาก clear timer)

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] เพิ่ม `webrtcTimeoutRef` ใน `RoomClient.tsx`; ตั้ง `setTimeout(10_000)` ใน `setupWebRTC()` — ใน callback ตรวจว่ายังไม่ connected (`!webrtcActive.current`) ก่อนสั่ง fallback
- [x] เคลียร์ timer ใน: `dc.onopen`, `onconnectionstatechange === "connected"`, และ `cleanupWebRTC()`
- [x] เพิ่ม `markRoomActive()` ใน branch `failed` ของ `onconnectionstatechange`
- [x] State poll หลัง fallback รับสถานะ `active` ได้ (connType เปลี่ยน → effect ยิง poll ทันที + [US-PERF-21b](US-PERF-21b.md) piggyback)
- [ ] ทดสอบ: (ก) จำลอง STUN ล้มเหลว (block UDP/`stun.l.google.com`) → เกมเริ่มแบบ polling ภายใน ~12 วิ, (ข) เชื่อมต่อปกติ → timer ไม่ยิง, (ค) ออกจากหน้าก่อนครบ 10 วิ → ไม่มี request ค้าง — **รอทดสอบจริง 2 browser**

## 📏 ผลลัพธ์ที่คาดหวัง (วัดได้)
- Time-to-board กรณี P2P ล้มเหลว: จาก **ไม่จำกัด (ติดจนห้องหมดอายุ 10 นาที)** → **≤ ~12 วิ**

## 🔗 Related Files
- Report: [P2P Performance Analysis](../report/2026-07-02-p2p-performance-analysis.md) (หัวข้อ 1)
- Code: `src/app/battle/room/[code]/RoomClient.tsx` (`setupWebRTC`, `setupDataChannel`, `cleanupWebRTC`), `src/app/api/battle/rooms/[code]/active/route.ts`
- เกี่ยวข้อง: [US-FIX-20c](US-FIX-20c.md) (WebRTC lifecycle), [US-PERF-21b](US-PERF-21b.md)
