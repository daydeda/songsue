# User Story: US-OPT-19d - Cache Announcement Singleton อย่างเหมาะสม

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Performance & API Cache Optimization](../01-product-backlog.md#16-performance--api-cache-optimization--ความเร็วและประสิทธิภาพระบบ)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** นักศึกษา  
**ฉันต้องการ** เห็นแบนเนอร์ประกาศสำคัญต่างๆ ปรากฏบนหน้าแดชบอร์ดทันทีตั้งแต่เริ่มโหลดหน้าจอโดยไม่มีอาการกระตุกหรือข้อความกะพริบขึ้นช้าหลังโหลดรูปเสร็จ  
**เพื่อให้** รับรู้ข่าวสารสำคัญได้อย่างรวดเร็ว ไม่เสียสมาธิเนื่องจากอาการขยับตัวของการจัดวางโครงสร้างหน้าจอ (Layout Shift) และลดการเชื่อมต่อยิง HTTP request ซ้ำๆ บนเซิร์ฟเวอร์  

---

## ✅ Acceptance Criteria
1. [ ] ข้อมูลแบนเนอร์ประกาศสำคัญ (Announcement Singleton) จะต้องปรับโครงสร้างไปเป็นการดึงและแสดงผลผ่านฝั่งเซิร์ฟเวอร์ (Server-side Pre-fetch) ภายในหน้าจอ `dashboard/page.tsx` แทนการใช้กลไกการ Poll จากฝั่งเบราว์เซอร์
2. [ ] ข้อมูลประกาศจะถูกจัดเก็บบันทึกบนหน่วยความจำแคช `unstable_cache` ตั้งรหัสตรวจสอบแคชเป็นแท็ก `"announcement"` และตั้งค่าอายุแคชสูงสุดที่ 300 วินาที
3. [ ] สั่งล้างข้อมูลแคชที่ล้าหลังและให้ระบบอัปเดตใหม่ทันที (`revalidateTag("announcement")`) เมื่อแอดมินแก้ไขข้อความประกาศผ่านหน้าคอนโทรลระบบ
4. [ ] ตัวหน้าจอต้องยกเลิกฟังก์ชันการเรียกขอข้อมูลประกาศจากฝั่งผู้ใช้ (Client-side Polling) ออกทั้งหมด เพื่อประหยัดช่องทางเชื่อมเน็ต

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] สแกนตรวจสอบและนำตัวเรียก Polling ใน `DashboardClient.tsx` ออก
- [ ] ย้ายการดึงชุดฐานข้อมูลประกาศมาไว้ในตัวเรนเดอร์ React Server Component หลักในเพจ `app/dashboard/page.tsx`
- [ ] เพิ่มคำสั่ง `unstable_cache` พร้อมการเชื่อมระบบ callbacks และการเคลียร์แท็กแคชเมื่อบันทึกข้อมูล
- [ ] ตรวจจับอาการ Layout Shift ในหน้าทดสอบเพื่อยืนยันว่าการแสดงผลเกิดขึ้นพร้อมกับการโหลดโค้ดเพจตั้งต้นสำเร็จ

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 06 Backlog](../sprint-backlogs/sprint-06.md)
- System Design: [System Design](../../software/01-system-design.md)
