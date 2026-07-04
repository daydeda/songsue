# User Story: US-GAME-18c - Host เห็นรายชื่อผู้เข้าร่วมแบบ Live

**Status:** ✅ Implemented (เสร็จสิ้น) via P2P OX Game Module
**Epic:** [Multi-Interactive Game Session (WebRTC/WebSocket)](../01-product-backlog.md#15-multi-interactive-game-session-webrtc--เกมร่วมกันแบบ-real-time-ในงาน)
**Owner:** Developer
**Version:** 1.1 | **Last Updated:** 2026-06-25

---

## 📖 Description
**ในฐานะ** ผู้ตั้งห้องเกม (Host Player)  
**ฉันต้องการ** เห็นสถานะการเข้าร่วมของคู่แข่งแบบสด (Real-time Connecting/Active Status)  
**เพื่อให้** ทราบว่าคู่ดวลได้เข้าสู่ห้องเกมเรียบร้อยแล้วและระบบเปลี่ยนผ่านไปหน้ากระดานดวลเกมได้ทันที  

---

## ✅ Acceptance Criteria
1. [x] หน้าจอห้องรอของ Host จะต้องแสดงสถานะการเชื่อมต่อของผู้ดวล (เช่น "รอกำลังเชื่อมต่อ WebRTC" หรือ "เชื่อมต่อสำเร็จ")
2. [x] เมื่อผู้ดวลเข้าร่วมสำเร็จ ระบบต้องทำการเปลี่ยนสถานะห้องเป็น `active` และ Redirect ทั้งสองผู้เล่นไปยังหน้ากระดานเกมโดยตรงโดยอัตโนมัติ
3. [x] มีการส่งสัญญาณ SDP Offer, Answer และ ICE Candidates ระหว่างคู่แข่งขันเพื่อเชื่อมต่อช่องทางสื่อสาร WebRTC
4. [x] ระบบจำลองการดึงสถานะห้องดวลผ่าน API Polling เป็นระยะ 2 วินาทีในกรณีที่ WebRTC peer-to-peer หลุดหรือเชื่อมต่อไม่ได้ (Automatic Fallback)
5. [x] หากคู่ดวลหรือตัวแทนตัดการเชื่อมต่อ ระบบประเมินเงื่อนไขและเปลี่ยนสถานะห้องให้เป็นยุติการแข่ง (Finished หรือ Disconnected)

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] พัฒนา API Endpoint `/api/battle/rooms/[code]/state` เพื่ออัปเดตและแจ้งดึงสถานะห้อง
- [x] ออกแบบการเชื่อมต่อ WebRTC Peer Connection แลกเปลี่ยน Signaling data
- [x] พัฒนากลไกตรวจเช็ค Fallback Polling (Interval 2000ms) บนส่วน Client-side
- [x] ทดสอบการ Join และทรานซิชันหน้าจอระหว่าง Host และ Guest ไปยังหน้ากระดานดวลเกมพร้อมกันเมื่อเชื่อมต่อสำเร็จ

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 05 Backlog](../sprint-backlogs/sprint-05.md)
- System Design: [System Design](../../software/01-system-design.md)
