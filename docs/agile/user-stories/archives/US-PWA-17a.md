# User Story: US-PWA-17a - ติดตั้งแอปบน Home Screen (Add to Home Screen)

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Progressive Web App (PWA)](../01-product-backlog.md#14-progressive-web-app-pwa--ติดตั้งใช้งานแบบ-native-app-บนมือถือ)
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** นักศึกษา  
**ฉันต้องการ** ติดตั้ง ActiveCAMT ไว้บน Home Screen ของโทรศัพท์มือถือได้โดยไม่ต้องผ่าน App Store หรือ Play Store  
**เพื่อให้** สามารถเปิดเข้าใช้งานระบบได้อย่างรวดเร็วเหมือนใช้แอปพลิเคชันปกติ และไม่มีแถบที่อยู่เว็บ (Address Bar) ของบราวเซอร์มารบกวนสายตา  

---

## ✅ Acceptance Criteria
1. [ ] แสดงผลในโหมด `standalone` (ไร้แถบ URL หรือควบคุมบนล่างของบราว์เซอร์)
2. [ ] บราวเซอร์ Chrome บนระบบ Android แสดงกล่องข้อความติดตั้งแอป (Install Prompt) เมื่อเข้าชมหน้าเว็บ
3. [ ] ผู้ใช้ iOS Safari สามารถกดเมนู Share และเลือก "Add to Home Screen" เพื่อติดตั้งได้สำเร็จ
4. [ ] ไอคอนและชื่อ "ActiveCAMT" แสดงผลอย่างถูกต้องบนหน้าจอหลัก (Home Screen) ของอุปกรณ์หลังจากติดตั้ง
5. [ ] ผู้ใช้ยังคงสถานะล็อกอินเข้าสู่ระบบได้แม้ปิด PWA และกดเปิดผ่านไอคอนบนหน้าจอใหม่อีกครั้ง

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] ตั้งค่าการเชื่อมต่อ manifest ไฟล์ใน Next.js metadata ใน `src/app/layout.tsx` (`metadata.manifest = "/manifest.json"`)
- [ ] สร้างไฟล์ `/public/manifest.json` เพื่อระบุรายละเอียดแอป ได้แก่:
  * `short_name`: "ActiveCAMT"
  * `name`: "ActiveCAMT - Activity & House Points Management"
  * `start_url`: "/"
  * `display`: "standalone"
  * `orientation`: "portrait"
  * `theme_color`: "#FFFFFF" (หรือสีหลักตามแบรนด์ดิ้ง)
  * `background_color`: "#FFFFFF"
- [ ] เขียนโค้ดดัก Event `beforeinstallprompt` บนเบราว์เซอร์และทำปุ่มติดตั้งเป็น Option เสริมบน Dashboard เพื่ออำนวยความสะดวกในการกด
- [ ] ทดสอบสร้างสเปก Build โลคอลและตรวจเช็กว่าไฟล์ Manifest ถูกอ่านได้จริงบนบราว์เซอร์ผ่าน DevTools Application tab

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 04 Backlog](../sprint-backlogs/sprint-04.md)
- System Design: [System Design](../../software/01-system-design.md)
