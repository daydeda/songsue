# User Story: US-PWA-17d - QR Scanner ทำงานได้ใน PWA Mode

**Status:** 🏗 Planned (วางแผน)
**Epic:** [Progressive Web App (PWA)](../01-product-backlog.md#14-progressive-web-app-pwa--ติดตั้งใช้งานแบบ-native-app-บนมือถือ)
**Owner:** QA & Dev
**Version:** 1.0 | **Last Updated:** 2026-06-18

---

## 📖 Description
**ในฐานะ** ผู้รับลงทะเบียน (Registration/SMO)  
**ฉันต้องการ** สามารถเปิดใช้งานแอปพลิเคชันผ่านหน้าจอหลัก (PWA Mode) แล้วอนุญาตให้เข้าถึงกล้องถ่ายภาพเพื่อสแกน QR Code เช็คอินผู้เข้าร่วมกิจกรรมได้ทันที  
**เพื่อให้** การดำเนินงานเช็คอินหน้างานเป็นไปได้อย่างราบรื่นและคล่องตัวสูง ไม่จำเป็นต้องสลับหน้าต่างไปยังเว็บเบราว์เซอร์ปกติ  

---

## ✅ Acceptance Criteria
1. [ ] แอปในโหมด Standalone สามารถเรียกฟังก์ชันกล้องถ่ายภาพผ่านโมดูล `html5-qrcode` ได้โดยไม่ต้องเด้งกลับเข้าหน้าจอบราวเซอร์ภายนอก
2. [ ] เมื่อกดเข้าหน้ากล้องครั้งแรกในโหมด PWA จะมีกล่องระบบแสดงขอรับสิทธิ์เข้าถึงกล้อง (Camera Permission Prompt) และผู้ใช้กดอนุญาตแล้วกล้องสามารถเริ่มต้นสแกนได้ทันที
3. [ ] สแกนเนอร์สามารถประมวลผล QR Token (ถอดรหัส HMAC) และบันทึกข้อมูลเข้าร่วมกิจกรรมบนหลังบ้านสำเร็จผ่านเครือข่ายเรียลไทม์
4. [ ] สำหรับระบบปฏิบัติการ iOS (Safari) ที่อาจมีนโยบายล็อกสิทธิ์กล้องในโหมด Standalone: หากพบว่าเบราว์เซอร์ไม่อนุญาตให้ใช้กล้อง หรือฟังก์ชัน `getUserMedia` ส่งข้อผิดพลาด (Exception/Failure) ระบบจะต้องเปิดหน้าต่างแสดงวิธีการเปิดหน้าเว็บผ่าน Safari ธรรมดา หรือมีปุ่มลัดนำทางกลับไปรันบน Safari ปกติแทน เพื่ออำนวยความสะดวกให้ผู้ใช้งานทำงานต่อได้
5. [ ] เมื่อยกเลิกหรือสแกนเสร็จสิ้น ตัวแอปจะทำลายอินสแตนซ์กล้อง (Destroy Instance) และคืนหน่วยความจำทันทีเพื่อความปลอดภัยและประหยัดแบตเตอรี่มือถือ

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] ศึกษาพฤติกรรมความปลอดภัยของ iOS/macOS Safari standalone mode ที่เกี่ยวเนื่องกับสิทธิ์ `navigator.mediaDevices.getUserMedia`
- [ ] อัปเดตและพัฒนาหน้าจอสำหรับสแกนกล้องเช็คอิน โดยเขียนฟังก์ชันตรวจเช็กสถานะการโหลดและเอ็กเซปชันจากคำสั่งขอเปิดกล้อง:
  ```typescript
  navigator.mediaDevices.getUserMedia({ video: true })
    .catch((error) => {
       // จัดการแสดง fallback แนะนำให้ทีมงานผู้สแกนเปิดผ่าน Safari เบราว์เซอร์ปกติ
    });
  ```
- [ ] เพิ่มหน้าต่างคำเตือน/วิธีแก้ปัญหา (Instructions banner) ซึ่งจะแสดงผลเฉพาะกรณีที่ตรวจพบว่าเป็นเครื่อง iOS และรันอยู่ภายใต้สถานะ standalone (`window.navigator.standalone === true`)
- [ ] ตรวจเช็ค Content Security Policy (CSP) และเพิ่มสิทธิ์ที่ปลอดภัยใน Middleware หรือ Next.js config เพื่อไม่ให้กล้องโดนบล็อกจาก Browser Sandbox
- [ ] ทดสอบกล้องและประเมินผลบนเครื่องมือถือจริง (ทั้งรุ่น Android และ iOS) ในสภาวะแวดล้อม PWA

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 04 Backlog](../sprint-backlogs/sprint-04.md)
- System Design: [System Design](../../software/01-system-design.md)
