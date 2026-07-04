# User Story: US-PWA-17b - หน้า Offline Fallback

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Progressive Web App (PWA)](../01-product-backlog.md#14-progressive-web-app-pwa--ติดตั้งใช้งานแบบ-native-app-บนมือถือ)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** นักศึกษา  
**ฉันต้องการ** เห็นหน้าแจ้งเตือนที่ระบุสถานะสัญญาณขาดหายได้ชัดเจนเมื่อโทรศัพท์ขาดการเชื่อมต่ออินเทอร์เน็ต  
**เพื่อให้** รับรู้ได้ว่าโปรแกรมตัวแอปพลิเคชันยังพร้อมทำงานปกติ แต่ต้องการสัญญาณอินเทอร์เน็ตในการดึงข้อมูลส่วนอื่นๆ แทนการเห็นหน้าเว็บพังสีขาวของบราวเซอร์ทั่วไป  

---

## ✅ Acceptance Criteria
1. [ ] ผู้ใช้เปิดแอปค้างไว้แล้วปิดเน็ต ต้องสามารถนำทางไปยังหน้าเพจออฟไลน์ได้โดยไม่ค้าง
2. [ ] หน้าเพจออฟไลน์อยู่ที่พาธ `/offline` โหลดภาพโลโก้ สัญลักษณ์ และข้อความเตือนการเชื่อมต่อทั้งภาษาไทยและอังกฤษได้โดยไม่ต้องใช้เครือข่าย
3. [ ] ในหน้าจอออฟไลน์มีปุ่ม "ลองใหม่อีกครั้ง" (Reload) เพื่อทำการเช็คสัญญาณและโหลดข้อมูลหน้าเดิมอีกครั้งเมื่อมีเน็ตกลับมา
4. [ ] Service Worker ต้องใช้ Network-First Cache Strategy สำหรับเส้นทาง URL ส่วนใหญ่ แต่หากขอรับข้อมูลล้มเหลว (Network Failure) จะต้องส่งกลับเป็นหน้าแคชของ `/offline` เสมอ
5. [ ] หน้าจอหลักแบบ App Shell (ส่วนบน/ล่างที่เป็น Navigation) ถูกแคชไว้ในเครื่องล่วงหน้าทำให้เปิดได้ไวแม้เปิดออฟไลน์

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] ติดตั้งไลบรารีจัดการ PWA `@ducanh2912/next-pwa` หรือใช้โครงสร้าง Service Worker ธรรมดา
- [ ] สร้างโฟลเดอร์เพจย่อย `src/app/offline/page.tsx`
- [ ] เขียนและตกแต่ง UI หน้าออฟไลน์ให้ลื่นไหล สวยงาม และ Responsive ป้องกัน Layout เพี้ยนบนอุปกรณ์มือถือ
- [ ] กำหนดค่าในส่วนของ Service Worker config ให้ทำการดาวน์โหลดและเก็บ Cache หน้าระดับเริ่มต้น `/offline` ไว้ล่วงหน้าทันทีที่ติดตั้ง (Pre-cache)
- [ ] เพิ่มโค้ดเช็คตัวแปรเบราว์เซอร์ `navigator.onLine` และเขียน Event dynamic ตรวจจับการเปลี่ยนแปลงออนไลน์/ออฟไลน์ (`window.addEventListener('offline')`)
- [ ] ทดสอบรัน `npm run build` และเข้าสู่ระบบ ทดสอบปิดเน็ตผ่าน DevTools (โหมด Offline ของบราวเซอร์) เพื่อยืนยันระบบโหลดหน้า `/offline` สำเร็จ

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 04 Backlog](../sprint-backlogs/sprint-04.md)
- System Design: [System Design](../../software/01-system-design.md)
