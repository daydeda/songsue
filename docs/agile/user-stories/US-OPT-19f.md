# User Story: US-OPT-19f - วัด Baseline และตรวจสอบ Core Web Vitals

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Performance & API Cache Optimization](../01-product-backlog.md#16-performance--api-cache-optimization--ความเร็วและประสิทธิภาพระบบ)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** Developer  
**ฉันต้องการ** วัดและเปรียบเทียบค่าประสิทธิภาพความเร็วในการโหลดและการโต้ตอบ (Core Web Vitals) ของระบบเว็บทั้งก่อนและหลังกระบวนการทำออปติไมซ์  
**เพื่อให้** มีตัวเลขที่ใช้ยืนยันผลสัมฤทธิ์อย่างเป็นทางการ มั่นใจได้ว่าทุกขั้นตอนทำงานได้จริงตามแผน และตัวโค้ดพร้อมปล่อยสู่เซิร์ฟเวอร์จริงอย่างไร้กังวล  

---

## ✅ Acceptance Criteria
1. [ ] ทำการทดสอบวัดคะแนนความเร็ว (Lighthouse Performance Audit) และเก็บข้อมูลของหน้านักเรียนและหน้าแอดมินก่อนแตะต้องโครงสร้างโค้ด เพื่อใช้เป็นฐานข้อมูลเปรียบเทียบ (Baseline)
2. [ ] กำหนดเป้าหมายเกณฑ์ความพึงพอใจการโหลด (Performance SLA) สำหรับอุปกรณ์มือถือที่ความเร็วระดับ 4G simulated:
   * **Largest Contentful Paint (LCP):** ≤ 2.5 วินาที
   * **Interaction to Next Paint (INP):** ≤ 200 มิลลิวินาที
   * **Cumulative Layout Shift (CLS):** ≤ 0.1
3. [ ] บันทึกและวิเคราะห์ค่าการเชื่อมต่อยิง HTTP request ที่ได้รับรายงานผ่านหน้าต่าง Vercel Speed Insights และ Chrome User Experience Report (CrUX)
4. [ ] จัดทำเอกสารสรุปคะแนนเปรียบเทียบตัวเลขความเร็ว ก่อน (Before) และ หลัง (After) จากการทำระบบแคชเพื่อส่งมอบเป็นรายงานความสำเร็จของ Sprint

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] ติดตั้งและเรียกใช้งาน Lighthouse ใน Chrome DevTools เพื่อเริ่มวัดคะแนนฐานหน้าระบบแดชบอร์ดหลักและหน้าเว็บล็อกอิน
- [ ] บันทึกภาพบันทึกผลและรายละเอียดคะแนน LCP, INP, และ CLS ก่อนแก้โค้ดลงบันทึกรายงาน
- [ ] รันการอัพเดตทดสอบซ้ำหลังจากแก้โค้ดใน Sprint 6 ทั้งหมดเรียบร้อยแล้ว
- [ ] สรุปตัวเลขอัตราการลดลงของจำนวน Query หรือเวลาตอบกลับและจัดทำเอกสาร Sprint Review Report

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 06 Backlog](../sprint-backlogs/sprint-06.md)
- System Design: [System Design](../../software/01-system-design.md)
