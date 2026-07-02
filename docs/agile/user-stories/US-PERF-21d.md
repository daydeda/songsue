# User Story: US-PERF-21d - Turn-aware Polling ลด Latency การเดินหมากในโหมด Fallback แบบ Load-neutral

**Status:** 🔍 Implemented — In Review (พัฒนาเสร็จ 2026-07-02; tsc/lint/vitest/build ผ่าน — รอวัดผลจริง 2 browser)
**Epic:** [P2P Performance Analysis 2026-07-02](../report/2026-07-02-p2p-performance-analysis.md) (P4)
**Priority:** 🟠 Moderate
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้เล่นเกม P2P Battle ที่ WebRTC ไม่ผ่าน (เล่นผ่าน HTTP polling)
**ฉันต้องการ** เห็นหมากของคู่แข่งเร็วขึ้น (จากช้าสุด 5 วิ เหลือ ~2.5 วิ)
**เพื่อให้** เกมโหมด fallback ยังรู้สึกลื่น โดยภาระ request รวมของทั้งคู่ไม่เกิน budget เดิม

## 🐛 ที่มาของปัญหา (จาก Performance Analysis — P4)
State poll ตอน `active` + polling ใช้ 5 วิเท่ากันทั้งสองฝั่ง (ตาม US-FIX-20g AC-3) — แต่ **ความต้องการข้อมูลของสองฝั่งไม่เท่ากัน**:
- ฝั่งที่**รอคู่แข่งเดิน** ต้องการ poll ถี่ (ข้อมูลใหม่จะมาเมื่อไหร่ก็ได้)
- ฝั่งที่**เป็นตาตัวเอง** แทบไม่ต้องการ poll เลย (ตัวเองเป็นคนสร้างข้อมูลถัดไป และ `POST /move` ก็คืน state สดให้อยู่แล้ว)

จึงจัดสรรความถี่ใหม่แบบไม่สมมาตรได้โดย load รวมของคู่ห้องแทบไม่เปลี่ยน

## 📐 การ Supersede US-FIX-20g AC-3
20g กำหนด "fallback poll ไม่ถี่กว่า 5 วิ" เพื่อคุม load รวม — story นี้ขอ supersede เป็นการคุมที่ **budget รวมต่อคู่ผู้เล่น** แทนความถี่รายคน:
- เดิม: 2 คน × 1 req/5 วิ = **0.40 req/s ต่อห้อง**
- ใหม่: ฝั่งรอ 1 req/2.5 วิ + ฝั่งเดิน 1 req/10 วิ = **0.50 req/s ต่อห้อง** (+25% เฉพาะห้อง fallback ซึ่งเป็นส่วนน้อย — ห้องที่ WebRTC สำเร็จยัง 30 วิเท่าเดิม)
- แลกกับ latency การเห็นหมากลดลงครึ่งหนึ่ง — ถือว่าคุ้มและยังอยู่ในเจตนารมณ์ของ 20g (กันการดึง connection pool จากระบบหลัก)

---

## ✅ Acceptance Criteria
1. [x] เมื่อ `status === "active"` และ `connType === "polling"`: ตา**คู่แข่ง** → poll ทุก **2.5 วิ**, ตา**ตัวเอง** → poll ทุก **10 วิ** (ตัวแปร `turnAwareMyTurn`)
2. [x] เมื่อเปลี่ยนตา interval ปรับทันที (effect dependency `turnAwareMyTurn` + immediate poll เมื่อ effect re-run)
3. [x] โหมด WebRTC (30 วิ) ไม่ re-run ตามตา (`turnAwareMyTurn` ถูก pin เป็น false นอกโหมด fallback), เฟส pre-game 2 วิ, หยุดเมื่อ `finished`/`expired`/tab hidden — คงเดิม
4. [ ] ผู้เล่นฝั่งรอเห็นหมากคู่แข่งช้าสุด ~2.5 วิ — **รอวัดจริงบน local โหมด fallback**
5. [ ] Request ต่อห้องต่อนาทีในโหมด fallback ไม่เกิน ~30 req/นาที — **รอบันทึกตัวเลขจริง**

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] แก้สูตร `intervalMs` ใน state-poll effect ของ `RoomClient.tsx` ด้วย `turnAwareMyTurn` เป็น dependency
- [x] Turn เปลี่ยนจาก data channel (โหมด webrtc) ไม่กระทบ interval (`turnAwareMyTurn` pin false เมื่อไม่ใช่ fallback)
- [x] อัปเดตหมายเหตุใน [US-FIX-20g](US-FIX-20g.md) ว่า AC-3 ถูก supersede โดย story นี้
- [ ] วัด req/นาที และ latency การเห็นหมาก ก่อน/หลัง บน local — **รอทดสอบจริง**

## 📏 ผลลัพธ์ที่คาดหวัง (วัดได้)
- Latency เห็นหมากคู่แข่ง (fallback): แย่สุด 5 วิ / เฉลี่ย 2.5 วิ → **แย่สุด 2.5 วิ / เฉลี่ย ~1.3 วิ**
- Load ต่อห้อง fallback: 0.40 → 0.50 req/s (ยอมรับ, ห้อง webrtc ไม่เปลี่ยน)

## 🔗 Related Files
- Report: [P2P Performance Analysis](../report/2026-07-02-p2p-performance-analysis.md) (หัวข้อ 2)
- Code: `src/app/battle/room/[code]/RoomClient.tsx` (state-poll effect)
- เกี่ยวข้อง: [US-FIX-20g](US-FIX-20g.md) (ถูก supersede บางส่วน), [US-PERF-21b](US-PERF-21b.md)
