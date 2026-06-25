# User Story: US-GAME-18b - ผู้เข้าร่วม Join ด้วย QR หรือ Room Code

**Status:** ✅ Implemented (เสร็จสิ้น) via P2P OX Game Module
**Epic:** [Multi-Interactive Game Session (WebRTC/WebSocket)](../01-product-backlog.md#15-multi-interactive-game-session-webrtc--เกมร่วมกันแบบ-real-time-ในงาน)
**Owner:** Developer
**Version:** 1.1 | **Last Updated:** 2026-06-25

---

## 📖 Description
**ในฐานะ** ผู้เล่นท้าดวล (Student/Guest Player)  
**ฉันต้องการ** เข้าร่วมห้องเล่นเกมโดยการสแกน QR Code หรือป้อนรหัสห้อง 4 หลักบนอุปกรณ์มือถือ  
**เพื่อให้** เข้าร่วมดวลเกมกับคู่แข่งได้อย่างสะดวกรวดเร็วหลังจากล็อกอินเข้าสู่ระบบและมีโปรไฟล์ที่ครบถ้วน  

---

## ✅ Acceptance Criteria
1. [x] ผู้เข้าร่วมที่สแกนคิวอาร์โค้ดจะต้องได้รับ Redirect ไปยังหน้า Join อัตโนมัติพร้อมกรอกรหัสห้องไว้ให้ในช่อง Input
2. [x] มีช่องทางให้ป้อนรหัสห้องด้วยตนเอง 4 หลัก (สำหรับคนที่พิมพ์คีย์บนหน้าเว็บหลัก)
3. [x] กล้องสแกน QR Code ทำงานผ่านเบราว์เซอร์ได้ทันทีโดยขออนุญาตใช้กล้องและแปลง URL ป้อนรหัสห้องให้เสร็จสรรพ
4. [x] ระบบจำกัดเฉพาะผู้ใช้ที่เป็นสมาชิกที่ล็อกอินผ่าน OAuth สำเร็จเท่านั้น (ป้องกันคนนอกแฝงตัวเข้ามาเล่น)
5. [x] ป้องกันไม่ให้ Host เข้าร่วมเล่นห้องตัวเองในฐานะคู่ดวล (Guest) และแจ้งเตือนข้อผิดพลาดหากพยายามทำเช่นนั้น

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] สร้างหน้า UI สำหรับ Join ห้องดวลเกมที่ `/battle/join`
- [x] พัฒนารูปแบบฟิลด์กรอกรหัสห้อง 4 ช่องพร้อม Auto-focus และรองรับการดึงรหัสห้องจาก URL Query Parameter
- [x] พัฒนาระบบสแกน QR Code ด้วยกล้องหลังมือถือผ่านไลบรารี `html5-qrcode`
- [x] เขียน API Endpoint ตรวจสอบสิทธิ์การเข้าเล่นและบันทึกผู้เล่นคู่ดวล (Guest ID) ลงในฐานข้อมูลห้องเกม (`/api/battle/rooms/[code]/join`)

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 05 Backlog](../sprint-backlogs/sprint-05.md)
- System Design: [System Design](../../software/01-system-design.md)
