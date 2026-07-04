# User Story: US-FIX-20c - แก้ WebRTC Lifecycle ไม่ให้ Connection ถูกปิดทันทีที่ต่อสำเร็จ

**Status:** 🔍 Implemented — In Review (พัฒนาเสร็จ 2026-07-02, ทดสอบ local แล้ว)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🟠 Moderate — ขึ้นกับ US-FIX-20a (build ต้องผ่านก่อนจึงทดสอบได้)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้เล่นเกม P2P Battle
**ฉันต้องการ** ให้การเชื่อมต่อ WebRTC data channel คงอยู่ตลอดทั้งเกมหลังจากจับคู่สำเร็จ
**เพื่อให้** การเดินหมากส่งถึงคู่แข่งแบบ real-time ตามจุดประสงค์ของ feature แทนที่จะตกกลับไปใช้ REST polling ทุกครั้ง

## 🐛 ที่มาของปัญหา (จาก Recheck Report — FIX-4)
ใน `RoomClient.tsx` effect ที่เรียก `setupWebRTC()` ถูก key ด้วย `[status]` และ return `cleanupWebRTC` เมื่อการเชื่อมต่อสำเร็จ → `markRoomActive()` → server เปลี่ยน status เป็น `active` → state poll อัปเดต `status` → React รัน cleanup ของ effect รอบก่อน → **ปิด peer connection + data channel ที่เพิ่งต่อได้** แล้ว `dc.onclose` สลับกลับเป็น polling ถาวร — ส่วน P2P ของ feature จึงแทบไม่เคยทำงานจริง

---

## ✅ Acceptance Criteria
1. [x] เมื่อ WebRTC ต่อสำเร็จและห้องเปลี่ยนเป็น `active` connection ต้อง**คงอยู่** (ตรวจด้วย indicator `connType === "webrtc"` ค้างตลอดเกม)
2. [x] `cleanupWebRTC()` ถูกเรียกเฉพาะ: component unmount, เกมจบ (`finished`/`expired`), หรือ connection fail จริง
3. [x] กรณี WebRTC ล้มเหลว (STUN ไม่ผ่าน/NAT ปิด) ยัง fallback เป็น polling ได้เหมือนเดิม
4. [x] การเดินหมากระหว่างสองเครื่องผ่าน data channel แสดงผลฝั่งตรงข้ามภายใน < 1 วินาที (ทดสอบจริง 2 browser/2 เครื่องบน local)
5. [x] ไม่มี memory/interval leak: ออกจากหน้าห้องแล้ว interval และ peer connection ถูกปิดครบ

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] แยก WebRTC lifecycle ออกจาก `useEffect([status])` — เช่น trigger setup ครั้งเดียวเมื่อเข้าสถานะ `connecting` (guard ด้วย ref) และผูก cleanup กับ unmount-only effect (`useEffect(() => cleanup, [])`)
- [x] เพิ่มการเรียก `cleanupWebRTC()` อย่างชัดเจนเมื่อ status เป็น `finished`/`expired`
- [x] ตรวจ `webrtcActive` / `connType` ให้สอดคล้องกับ lifecycle ใหม่ (ไม่ค้างค่า stale)
- [x] ทดสอบ E2E บน local: host + guest คนละ browser เล่นจบเกมโดย `connType` เป็น `webrtc` ตลอด, ทดสอบ fallback โดย block STUN
- [x] บันทึกผลการทดสอบใน PR

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../../report/2026-07-02-p2p-game-recheck.md) (FIX-4)
- Code: `src/app/battle/room/[code]/RoomClient.tsx`
- เกี่ยวข้อง: [US-FIX-20d](US-FIX-20d.md) (ICE append), [US-FIX-20g](US-FIX-20g.md) (polling load)
