# User Story: US-OPT-19e - กำหนด Cache-Control Headers ที่ถูกต้องในทุก API Route

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Performance & API Cache Optimization](../01-product-backlog.md#16-performance--api-cache-optimization--ความเร็วและประสิทธิภาพระบบ)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** Developer  
**ฉันต้องการ** ตรวจเช็คและกำหนดค่าหัวข้อหัวข่าวแคช (Cache-Control Headers) บนทุกๆ เส้นทางคำสั่ง API ให้เหมาะสมกับความอ่อนไหวของข้อมูลผู้ใช้  
**เพื่อให้** อุปกรณ์เบราว์เซอร์ รวมถึงระบบเกตเวย์กระจายการเชื่อมต่อ (เช่น Nginx หรือ CDN) ทราบสิทธิ์และสภาวะการถือแคชที่ถูกต้อง ป้องกันปัญหาข้อมูลรั่วไหลหรือการโหลดซ้ำโดยไม่จำเป็น  

---

## ✅ Acceptance Criteria
1. [ ] ทุกๆ API Route ในโปรเจกต์จะถูกอัปเดตหรือกำหนดคุณสมบัติ headers ให้มีฟิลด์ `Cache-Control` ที่ชัดเจน
2. [ ] สำหรับข้อมูลที่เป็นสาธารณะและไม่มีความอ่อนไหว เช่น หน้ารายการบ้านและสถิติหลัก: กำหนดใช้นโยบายแบบเก็บและแชร์ข้อมูลได้ ได้แก่ `public, s-maxage=30, stale-while-revalidate=60`
3. [ ] สำหรับข้อมูลเฉพาะตัวของผู้ใช้ซึ่งเปราะบางและเป็นข้อมูลส่วนบุคคล เช่น ข้อมูลโรคประจำตัว คะแนนสะสมรายคน และประวัติคำสั่งซื้อของที่ระลึก: กำหนดใช้นโยบายแบบห้ามเก็บแคช ได้แก่ `private, no-store, no-cache, must-revalidate`
4. [ ] สร้างเอกสารแสดงตารางการตรวจสอบหัวข้อแคช (Cache-Control Audit Checklist) เพื่อใช้ตรวจเช็คทุกๆ API ในระบบสำหรับเป็นแนวทางการพัฒนาต่อของทีมงาน

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] รวบรวมรายชื่อของ API Routes ทั้งหมดในโปรเจกต์พร้อมจำแนกประเภทความปลอดภัย (Public / Private)
- [ ] ไล่เขียนหรือแก้ไขฟังก์ชันการตอบกลับของ HTTP Response บน Next.js ให้มีหัวข้อ `headers` ที่ระบุรูปแบบ `Cache-Control` ตามเกณฑ์ที่ยอมรับ
- [ ] ทดสอบความถูกต้องของสัญญาน Headers โดยรันคำสั่งร้องขอผ่านเครื่องมือทดสอบ เช่น `curl -I http://localhost:3000/api/...` เพื่อตรวจดูโครงสร้าง
- [ ] บันทึกผลลัพธ์ลงเอกสารเพื่อยืนยันว่าไม่มีจุดไหนหลุดการกำหนดค่า

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 06 Backlog](../sprint-backlogs/sprint-06.md)
- System Design: [System Design](../../software/01-system-design.md)
