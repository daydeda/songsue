# User Story: US-GAME-18a - Staff สร้างห้องเกม (Game Room)

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Multi-Interactive Game Session (WebRTC/WebSocket)](../01-product-backlog.md#15-multi-interactive-game-session-webrtc--เกมร่วมกันแบบ-real-time-ในงาน)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** Staff (Host)  
**ฉันต้องการ** สร้างห้องเกมพร้อมแสดงรหัสห้อง (Room Code) 6 หลัก และสร้าง QR Code สำหรับเข้าร่วมเกมได้ทันที  
**เพื่อให้** ผู้เข้าร่วมงานสามารถกดสแกนเข้าร่วมล็อบบี้เตรียมตัวเริ่มเกมได้อย่างสะดวกและรวดเร็ว  

---

## ✅ Acceptance Criteria
1. [ ] Staff/Host สามารถเข้าเมนูจัดการห้องเกมผ่าน Admin Panel เพื่อกดสร้างห้องใหม่ได้
2. [ ] เมื่อกดสร้างห้อง ระบบจะต้องสร้างรหัสรหัสห้อง (Room Code) 6 หลักแบบสุ่มที่เป็นเอกลักษณ์ (Unique) ณ เวลานั้น (เช่น A-Z, 0-9)
3. [ ] หน้าจอสำหรับ Host มีการแสดงผล QR Code ขนาดใหญ่ที่ถอดรหัสเชื่อมโยง URL ไปยังลิงก์เข้าร่วมห้องของนักเรียนโดยตรง เพื่อสะดวกสำหรับฉายขึ้นจอโปรเจกเตอร์
4. [ ] ห้องเกมมีอายุการใช้งานจำกัด (สูงสุดไม่เกิน 3 ชั่วโมง) และจะถูกทำลายหรือปิดโดยอัตโนมัติหากตรวจพบว่า Host ไม่มีการสตรีมหรือเชื่อมต่อเกินกว่า 60 วินาที
5. [ ] ข้อมูลห้องถูกเก็บบันทึกบนหน่วยความจำชั่วคราว (เช่น Redis หรือ Node-Memory Store) เพื่อลดภาระการเขียนฐานข้อมูล SQL

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] ติดตั้งไลบรารีสำหรับสร้างภาพ QR Code (เช่น `qrcode` หรือฟรอนต์เอนด์ `qrcode.react`)
- [ ] พัฒนา API Endpoint หรือ WebSocket event ในส่วนควบคุม `socket-server` สำหรับสุ่มคีย์ห้อง 6 หลัก พร้อมบันทึกสถานะห้องในหน่วยความจำ
- [ ] พัฒนาหน้าจอ Host Room Dashboard สำหรับควบคุมเกมและรับข้อมูลจาก Socket.IO
- [ ] เขียนฟังก์ชันทำความสะอาดห้องเก่า (Cleanup room garbage collector) ที่หมดอายุหรือปิดใช้งานแล้ว

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 05 Backlog](../sprint-backlogs/sprint-05.md)
- System Design: [System Design](../../software/01-system-design.md)
