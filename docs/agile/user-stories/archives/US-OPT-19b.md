# User Story: US-OPT-19b - เก็บ user.major ใน JWT Session เพื่อตัด DB Query ซ้ำ

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Performance & API Cache Optimization](../01-product-backlog.md#16-performance--api-cache-optimization--ความเร็วและประสิทธิภาพระบบ)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** นักศึกษา  
**ฉันต้องการ** ให้แอปสามารถดึงข้อมูลและกรองกิจกรรมเฉพาะสำหรับสาขาวิชาเรียนของฉันได้ทันทีโดยไม่ต้องรอดึงข้อมูลใหม่จากตารางระบบฐานข้อมูลบ่อยครั้ง  
**เพื่อให้** หน้าเพจหลักแสดงผลลัพธ์ข้อมูลเฉพาะทางได้รวดเร็ว และประหยัดท่อส่งคำสั่งของเครื่องเซิร์ฟเวอร์  

---

## ✅ Acceptance Criteria
1. [ ] ปรับปรุง NextAuth Config ให้ผูกเก็บข้อมูลฟิลด์สาขาการศึกษา (`major`) ของตัวผู้ใช้เข้าไปอยู่ร่วมกับโครงสร้างข้อมูลของ JWT Session token ตั้งแต่ขั้นตอนล็อกอิน
2. [ ] สแกนและนำเอา SQL คิวรี่ดึงข้อมูลวิชาเรียน เช่น `db.query.users.findFirst({ columns: { major } })` ที่เคยถูกเรียกใช้ชั่วคราวในฝั่ง API ย่อยต่างๆ ออกไปทั้งหมด
3. [ ] ข้อมูลสาขาการศึกษาของนักศึกษาจะต้องถูกดึงอ้างอิงตรงผ่าน `session.user.major` ที่ติดอยู่ใน Web Cookie ได้ทันที
4. [ ] หากนักศึกษามีการแก้ไขสาขาวิชาเรียนในส่วนแก้ไขข้อมูลส่วนตัว ระบบจะต้องบังคับสลับสิทธิ์การส่งคีย์และสั่ง Refresh Session token (เช่น Force Token Refresh callback) เพื่อปรับข้อมูลในเครื่องให้ตรงกันปัจจุบัน

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] ค้นหาและแก้ไขคีย์การทำ callbacks ในหน้าตั้งค่า `src/auth.ts` (หรือส่วนควบคุม NextAuth) เพื่อขยายขนาดข้อมูลผู้ใช้และแทรกฟิลด์ `major` ลงไป
- [ ] ปรับแก้โค้ดของไฟล์ดึงข้อมูลกิจกรรม `/api/events/route.ts` ให้เรียกใช้ค่าสาขาวิชาจาก Session ที่แปลงเสร็จแทนการสั่งหา SQL จากไอดีแถวข้อมูลผู้ใช้
- [ ] ทดสอบเช็ครายละเอียดโครงสร้างข้อมูล Token โดยใช้เครื่องมือ DevTools Application > Cookies เพื่อตรวจสอบสถานะข้อมูล

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 06 Backlog](../sprint-backlogs/sprint-06.md)
- System Design: [System Design](../../software/01-system-design.md)
