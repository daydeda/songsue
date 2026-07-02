# User Story: US-GAME-18a - Staff สร้างห้องเกม (Game Room)

**Status:** ✅ Implemented (เสร็จสิ้น) via P2P OX Game Module
**Epic:** [Multi-Interactive Game Session (WebRTC/WebSocket)](../01-product-backlog.md#15-multi-interactive-game-session-webrtc--เกมร่วมกันแบบ-real-time-ในงาน)
**Owner:** Developer
**Version:** 1.1 | **Last Updated:** 2026-06-25

---

## 📖 Description
**ในฐานะ** Student/Host (ผู้ท้าชิง)  
**ฉันต้องการ** สร้างห้องเกมพร้อมแสดงรหัสห้อง (Room Code) 4 หลัก และสร้าง QR Code สำหรับเข้าร่วมเกมได้ทันที  
**เพื่อให้** ผู้เล่นอีกคนสแกนเข้าร่วมล็อบบี้เตรียมตัวเริ่มเกมได้อย่างสะดวกและรวดเร็ว  

---

## ✅ Acceptance Criteria
1. [x] Student/Host สามารถสร้างห้องเกมใหม่ผ่านเมนู P2P Battle ได้
2. [x] เมื่อกดสร้างห้อง ระบบจะต้องสร้างรหัสห้อง (Room Code) 4 หลักแบบสุ่มที่เป็นเอกลักษณ์ (Unique) ณ เวลานั้น (คัดเฉพาะตัวอักษรไม่สับสนออก เช่น A-Z ยกเว้น I, O, 0, 1)
3. [x] หน้าจอสำหรับ Host มีการแสดงผล QR Code ขนาดใหญ่ที่เชื่อมโยง URL ไปยังลิงก์เข้าร่วมห้องของนักเรียนโดยตรง เพื่อความสะดวกในการสแกนดวลกัน
4. [x] ห้องเกมมีอายุการใช้งานจำกัด (หมดอายุใน 10 นาทีหากไม่มีคนเข้าร่วม) และจะถูกทำลายหรือปิดโดยอัตโนมัติเมื่อสิ้นสุดการเล่น
5. [x] ข้อมูลห้องและ SDP signaling ถูกเก็บบันทึกบน Next.js server thread เพื่อลดภาระการเขียนฐานข้อมูล SQL

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] ติดตั้งไลบรารีสำหรับสร้างภาพ QR Code (ใช้ `qrcode.react`)
- [x] พัฒนา API Endpoint `/api/battle/rooms` สำหรับสร้างห้องและสุ่มคีย์ห้อง 4 หลัก
- [x] พัฒนาหน้าจอห้องล็อบบี้ Host Room Dashboard สำหรับรอรับผู้เล่นและการเชื่อมต่อ WebRTC/REST polling
- [x] เขียนระบบจัดการหมดอายุห้อง (Expires check) เมื่อเรียกข้อมูลสถานะห้องเก่าที่หมดเวลาไปแล้ว

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 05 Backlog](../sprint-backlogs/sprint-05.md)
- System Design: [System Design](../../software/01-system-design.md)
