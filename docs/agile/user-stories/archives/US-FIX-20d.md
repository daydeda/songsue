# User Story: US-FIX-20d - แก้การส่ง ICE Candidates ให้ Append ฝั่ง Server แทนการเขียนทับ

**Status:** 🔍 Implemented — In Review (พัฒนาเสร็จ 2026-07-02, ทดสอบ local แล้ว)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🟠 Moderate — ขึ้นกับ US-FIX-20a
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้เล่นเกม P2P Battle
**ฉันต้องการ** ให้ ICE candidates ทุกตัวที่ browser ค้นพบถูกส่งถึงคู่แข่งครบถ้วน
**เพื่อให้** การเจรจาเชื่อมต่อ WebRTC สำเร็จอย่างสม่ำเสมอ ไม่ใช่สำเร็จแบบขึ้นกับดวงว่า candidate ตัวสุดท้ายใช้ได้หรือไม่

## 🐛 ที่มาของปัญหา (จาก Recheck Report — FIX-5)
1. ฝั่ง client (`uploadIceCandidate` ใน `RoomClient.tsx`): GET `/signal` คืนข้อมูลของ**ฝั่งตรงข้าม**เสมอ (`role: opponentRole`) ทำให้เงื่อนไข `data.role === myRole` ไม่มีวันเป็นจริง → `existingCandidates` ว่างเสมอ → ทุก POST เขียนทับ array ทั้งก้อนเหลือ candidate ตัวเดียว
2. แม้เงื่อนไขถูก ก็ยังเป็น read-modify-write ฝั่ง client — candidates ที่เกิดถี่ๆ จะ race กันเองและหายไป

---

## ✅ Acceptance Criteria
1. [x] Client ส่ง ICE candidate **ทีละตัว** (payload เล็ก ไม่มี read-modify-write ฝั่ง client)
2. [x] Server (`signal/route.ts`) เป็นผู้ append candidate ลง `ice_candidates` แบบ atomic (เช่น `SET ice_candidates = ice_candidates || :new` ใน SQL เดียว) — ไม่มี candidate หายแม้ POST ซ้อนกัน
3. [x] GET `/signal` ยังคงคืน candidates ของฝั่งตรงข้ามครบทุกตัวตามลำดับ
4. [x] จำนวน candidates ต่อ record มีเพดาน (เช่น ≤ 30 ตัว) เพื่อกัน payload บวม — เกินแล้วปฏิเสธ
5. [x] ทดสอบจริง: host/guest ต่อกันสำเร็จติดต่อกัน ≥ 5 ครั้งบนเครือข่ายเดียวกัน และ log ยืนยันว่า candidates ทุกตัวถูกเก็บครบ

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] เพิ่มรูปแบบ request ใหม่ใน `POST /api/battle/rooms/[code]/signal`: field `iceCandidate` (ตัวเดียว) — server append ด้วย jsonb concat ใน query เดียว
- [x] ตัด logic GET-ก่อน-POST ใน `uploadIceCandidate` ฝั่ง client ให้เหลือ POST candidate เดียวตรงๆ
- [x] คง compatibility ของ field `sdpOffer`/`sdpAnswer` เดิม
- [x] เพิ่มเพดานจำนวน candidates + ตรวจรูปร่าง candidate ขั้นต่ำ (มี `candidate`/`sdpMid` เป็น string)
- [x] ทดสอบการเชื่อมต่อซ้ำหลายรอบ + กรณี candidates มาถี่พร้อมกัน

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../../report/2026-07-02-p2p-game-recheck.md) (FIX-5)
- Code: `src/app/api/battle/rooms/[code]/signal/route.ts`, `src/app/battle/room/[code]/RoomClient.tsx`
- เกี่ยวข้อง: [US-FIX-20f](US-FIX-20f.md) (validate payload ทั้ง route ด้วย Zod)
