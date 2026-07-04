# User Story: US-OPT-19a - แยก Static Events Data ใน /api/events

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Performance & API Cache Optimization](../01-product-backlog.md#16-performance--api-cache-optimization--ความเร็วและประสิทธิภาพระบบ)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** นักศึกษา  
**ฉันต้องการ** โหลดหน้ารายการกิจกรรมต่างๆ ได้เร็วขึ้นโดยไม่มีหน้าจอกระตุกหรือค้างรอข้อมูลนาน  
**เพื่อให้** แดชบอร์ดเปิดทำงานได้อย่างราบรื่น และลดจำนวนการรันคิวรีซ้ำซ้อนบนระบบฐานข้อมูลหลักเมื่อมีผู้ใช้เปิดหน้าแดชบอร์ดพร้อมกันเป็นจำนวนมาก  

---

## ✅ Acceptance Criteria
1. [ ] แยก API โหลดข้อมูลกิจกรรม `/api/events` ออกเป็นสองส่วนย่อย: ข้อมูลรายการเนื้อหากิจกรรมที่เป็นของสาธารณะ (Static) และ ข้อมูลสถานะการเช็คอิน/ลงทะเบียนเฉพาะของตัวผู้ใช้เอง (Dynamic/User-specific)
2. [ ] ข้อมูลรายการกิจกรรมกลาง (Static) จะต้องถูกประมวลผลผ่านกลไกแคช `unstable_cache` ของ Next.js และติดแท็กระบุตัวไว้เป็น `"events"` โดยกำหนดให้อายุแคชเก็บได้นาน 60 วินาที
3. [ ] ระบบต้องล้างแคชทิ้งเพื่อความสดใหม่ทันที (`revalidateTag("events")`) เมื่อมีการเรียกคำสั่งบันทึก แก้ไข หรืออัปเดตสถานะกิจกรรมใหม่โดยแอดมินหลังบ้าน
4. [ ] ความเร็วในการตอบสนอง (Response time) ของคำสั่งเรียกขอข้อมูลกิจกรรมลดลงไม่น้อยกว่า 40% เมื่อดึงผ่านหน่วยความจำที่ติดแคช (Cache Hit)

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] สแกนโค้ดไฟล์ `src/app/api/events/route.ts` เพื่อแยกส่วน SQL Query และจำแนกออกเป็นฟังก์ชันย่อยที่รับและส่งเฉพาะค่าเนื้อหาสแตติก
- [ ] ครอบฟังก์ชันเนื้อหาหลักด้วย API `unstable_cache` ของ Next.js พร้อมระบุคีย์แท็ก `"events"`
- [ ] ค้นหาจุดบันทึก/แก้ไขกิจกรรมของแอดมิน (เช่นใน `/api/admin/events/route.ts`) แล้วแทรกชุดคำสั่ง `revalidateTag("events")` หรือ `revalidatePath` เข้าไป
- [ ] ทดสอบประสิทธิภาพการทำงานบนระบบจำลอง (Local test build) เพื่อวัดเวลาเปรียบเทียบในหน้ารายงานเน็ตเวิร์ก

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 06 Backlog](../sprint-backlogs/sprint-06.md)
- System Design: [System Design](../../software/01-system-design.md)
