# User Story: US-GAME-18c - Host เห็นรายชื่อผู้เข้าร่วมแบบ Live

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Multi-Interactive Game Session (WebRTC/WebSocket)](../01-product-backlog.md#15-multi-interactive-game-session-webrtc--เกมร่วมกันแบบ-real-time-ในงาน)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** Staff (Host)  
**ฉันต้องการ** เห็นรายชื่อชื่อเล่นและจำนวนผู้เล่นที่กดเข้าห้องเชื่อมต่อเข้ามารายงานตัวแบบสด (Real-time)  
**เพื่อให้** ประเมินสถานการณ์ได้ว่ามีผู้เล่นเข้าร่วมครบตามจำนวนผู้จัดงานตั้งเป้าไว้แล้ว จึงกดสั่งเริ่มเริ่มเกมนวดความสนุกได้พร้อมกัน  

---

## ✅ Acceptance Criteria
1. [ ] หน้าจอแผงแอดมินหรือ Host Lobby จะต้องแสดงรายชื่อผู้เล่นที่เข้ามาอัปเดตแบบอัตโนมัติโดยไม่มีการรีเฟรชหน้าเว็บ (Real-time updates)
2. [ ] มีตัวเลขนับจำนวนผู้ร่วมเล่นรวมในรูปแบบสะสมสด (เช่น "ผู้เล่น: 45 คน")
3. [ ] รายชื่อที่เด้งเข้ามาในจอภาพควรมีอนิเมชันเคลื่อนไหวเบาๆ (Fade-in / Bounce) เพื่อให้หน้าจอแสดงผลดูมีปฏิสัมพันธ์และมีชีวิตชีวา
4. [ ] Host สามารถกดปุ่ม "เริ่มเกม" (Start Game) ซึ่งจะส่งสัญญาณควบคุมผ่านช่องสัญญาณ WebSocket ให้ผู้เข้าร่วมทุกคนเปลี่ยนหน้าจอไปที่หน้าเริ่มพร้อมกัน
5. [ ] ระบบต้องคอยตรวจจับและดึงชื่อเล่นผู้ใช้ที่ขาดการเชื่อมต่อ (Disconnect) ออกจากแผงหน้าจอและลดจำนวนผู้นับโดยอัตโนมัติ

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] พัฒนา WebSocket event สำหรับแจ้งเตือนเมื่อมีผู้เล่นใหม่เชื่อมต่อ (`playerJoined`) หรือหลุดการเชื่อมต่อ (`playerLeft`)
- [ ] ตกแต่ง UI ล็อบบี้ให้รองรับ Responsive Layout และแอนิเมชันสำหรับ React Elements
- [ ] พัฒนาระบบส่งสัญญาณแบบกระจายเสียง (Broadcast system) สำหรับควบคุมสถานการณ์เริ่มเกมส่งไปยังผู้เชื่อมต่อใน Room เดียวกันทั้งหมด
- [ ] เพิ่มโค้ดการจัดการ Session เพื่อตรวจเช็ค Heartbeat ความเสถียรของผู้ใช้เป็นระยะ

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 05 Backlog](../sprint-backlogs/sprint-05.md)
- System Design: [System Design](../../software/01-system-design.md)
