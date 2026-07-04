# User Story: US-GAME-18i - Host จัดการ Session และปิดห้องอย่างสง่างาม

**Status:** ✅ Implemented (เสร็จสิ้น) via P2P OX Game Module
**Epic:** [Multi-Interactive Game Session (WebRTC/WebSocket)](../01-product-backlog.md#15-multi-interactive-game-session-webrtc--เกมร่วมกันแบบ-real-time-ในงาน)
**Owner:** Developer
**Version:** 1.1 | **Last Updated:** 2026-06-25

---

## 📖 Description
**ในฐานะ** ผู้เล่นในห้องเกม (Host/Guest Player)  
**ฉันต้องการ** ยอมแพ้ (Resign) หรือหยุดเล่นได้ตลอดเวลา และต้องการให้ระบบเคลียร์ทรัพยากรห้องอย่างสง่างามเมื่อเกมยุติลง  
**เพื่อให้** อัปเดตอันดับผู้ชนะและผู้แพ้ลงฐานข้อมูลอย่างถูกต้อง และสิ้นสุดเซสชันเกมเพื่อคืนทรัพยากรระบบ  

---

## ✅ Acceptance Criteria
1. [x] ผู้เล่นมีปุ่ม "ยอมแพ้" (Resign) ที่ทำงานได้ทันทีเมื่ออยู่ในสถานะเกมกำลังดำเนินการอยู่ (Active)
2. [x] เมื่อกดปุ่มยอมแพ้ ระบบจะบันทึกสถานะห้องเป็น `finished`, กำหนดเหตุผลจบเกมเป็น `resign`, และปรับให้ฝ่ายตรงข้ามเป็นผู้ชนะทันที
3. [x] มีกลไกการจำกัดเวลาเดินหมาก (Turn Deadline) 60 วินาที โดยตรวจเช็คผ่าน Lazy Evaluation: เมื่อผู้เล่นอื่นดึงสถานะแล้วพบว่าเวลาเกินกำหนด ระบบจะปรับสิทธิ์ฝ่ายตรงข้ามชนะฟาวล์ (forfeit) ทันที
4. [x] ข้อมูลผลลัพธ์การแข่ง (winnerId, finishReason, score) ถูกจัดเก็บถาวรลงฐานข้อมูล SQL (`game_rooms`) ทันทีที่การแข่งขันจบลม
5. [x] ช่องแลกเปลี่ยนสัญญาณ WebRTC (`webrtc_signals`) ถูกลบหรือหมดอายุความสำคัญโดยสมบูรณ์ร่วมกับห้องเพื่อคืนทรัพยากร

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] พัฒนา API Endpoint `/api/battle/rooms/[code]/resign` จัดการยอมแพ้และอัปเดต Ledger
- [x] พัฒนากลไก Lazy Forfeit Check บน API `/api/battle/rooms/[code]/state` และ `/api/battle/rooms/[code]/move` เพื่อตรวจสอบเวลาและบันทึกผล
- [x] เขียนฟังก์ชันการอัปเดตสถิติสะสม (Wins/Losses) ลง `game_stats` ในระดับ Transaction เพื่อความปลอดภัยของข้อมูล
- [x] ทดสอบการ Resign และ Turn Timeout ในส่วนควบคุม Client/Server เพื่อยืนยันว่าการเก็บสถิติบุกเบิกขึ้นทันทีเมื่อยุติเกม

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 05 Backlog](../sprint-backlogs/sprint-05.md)
- System Design: [System Design](../../software/01-system-design.md)
