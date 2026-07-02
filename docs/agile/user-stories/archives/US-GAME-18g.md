# User Story: US-GAME-18g - Leaderboard แสดงอันดับหลังแต่ละรอบ

**Status:** ✅ Implemented (เสร็จสิ้น) via P2P OX Game Module
**Epic:** [Multi-Interactive Game Session (WebRTC/WebSocket)](../01-product-backlog.md#15-multi-interactive-game-session-webrtc--เกมร่วมกันแบบ-real-time-ในงาน)
**Owner:** Developer
**Version:** 1.1 | **Last Updated:** 2026-06-25

---

## 📖 Description
**ในฐานะ** ผู้ดวลเกม (Student/Player)  
**ฉันต้องการ** เห็นตารางจัดอันดับผู้นำ (Leaderboard) ของผู้แข่งขันทั้งหมดในระบบ พร้อมสถิติส่วนตัว ชนะ/แพ้/เสมอ และสตรีคสะสม  
**เพื่อให้** สามารถเปรียบเทียบอันดับของตนเองและแข่งขันกันอย่างสนุกสนานภายในสมาชิกงานเดียวกัน  

---

## ✅ Acceptance Criteria
1. [x] หน้าจอ Battle Hub มีแท็บตารางผู้นำ (Leaderboard) แสดงผู้เล่นที่มีสถิติชนะสูงสุด 20 อันดับแรก
2. [x] การเรียงอันดับจัดตามลำดับความสำคัญ: จำนวนการชนะ (Wins) สูงสุด, และกรณีชนะเท่ากันเรียงตามสตรีคสูงสุด (Best Streak)
3. [x] หน้าจอหลักของผู้เล่นแสดงผลสถิติส่วนตัวการเล่นเกม OX ทั้งหมด ได้แก่ Wins, Losses, Draws, Current Streak และ Best Streak พร้อมประวัติการเล่น 10 นัดล่าสุด
4. [x] เมื่อจบเกมการดวล จะแสดงหน้าต่างผลการดวลทันที (Result modal) ระบุผลชนะ/แพ้/เสมอ พร้อมอัปเดตสถิติและคะแนนสตรีคแบบเคลื่อนไหวสวยงาม

---

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [x] พัฒนา API Endpoint `/api/battle/leaderboard` ดึงรายชื่ออันดับและจัดเรียงข้อมูล
- [x] พัฒนา API Endpoint `/api/battle/stats/me` สำหรับเรียกดูสถิติและประวัติประวัติส่วนตัวผู้ใช้ที่เข้าใช้ระบบ
- [x] ออกแบบหน้าจอ Battle Hub UI ที่มีแท็บสลับระหว่างหน้าห้องแข่ง, สถิติส่วนตัว และตารางอันดับผู้นำ (Leaderboard)
- [x] ตกแต่ง Result Dialog Component แสดงผลตอนจบเกมด้วย Tailwind/CSS พร้อมปุ่ม CTA สำหรับออกหรือเล่นต่อ

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- Sprint Plan: [Sprint 05 Backlog](../sprint-backlogs/sprint-05.md)
- System Design: [System Design](../../software/01-system-design.md)
