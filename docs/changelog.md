# Documentation Changelog

ประวัติการปรับปรุงและอัปเดตเอกสารระบบ **ActiveCAMT**

| วันที่ | เวอร์ชันเอกสาร | รายละเอียดการแก้ไข | ผู้รับผิดชอบ |
| :--- | :--- | :--- | :--- |
| 2026-06-18 | v1.0 | จัดทำชุดเอกสารการพัฒนา (Development Documentation) ครั้งแรก ครอบคลุม System Design, Class/Process Flows, Data Schema, Backlog, Sprint Roadmap และ Wiki | Antigravity AI |
| 2026-06-18 | v1.1 | เพิ่ม Product Backlog หมวด 1.4 (PWA: US-PWA-17a–17d) และ Sprint 4 ในแผนงาน สำหรับ Feature Progressive Web App | Antigravity AI |
| 2026-06-18 | v1.2 | เพิ่ม Product Backlog หมวด 1.5 (Game: US-GAME-18a–18i) และ Sprint 5 ในแผนงาน สำหรับ Feature Multi-Interactive Game Session (Quiz / Mini-game / Live Poll) | Antigravity AI |
| 2026-06-18 | v1.3 | เพิ่ม Product Backlog หมวด 1.6 (Optimization: US-OPT-19a–19f) และ Sprint 6 ในแผนงาน สำหรับ Performance & API Cache Optimization (Events cache, JWT major, hot-path cleanup, Core Web Vitals) | Antigravity AI |
| 2026-06-18 | v1.4 | จัดทำ Sprint Backlogs (Sprint 4, 5, 6) และแตกรายละเอียด User Stories ย่อย (US-PWA-17a ถึง US-PWA-17d) สำหรับเตรียมการพัฒนาระบบ | Antigravity AI |
| 2026-06-18 | v1.5 | จัดทำและแตกรายละเอียดโครงงานย่อย (User Stories) ของ Sprint 05 (US-GAME-18a ถึง 18i) และ Sprint 06 (US-OPT-19a ถึง 19f) ครบถ้วน | Antigravity AI |
| 2026-06-18 | v1.6 | ย้ายเอกสารถอดบทเรียนระบบ Google OAuth ไปจัดเก็บใน docs/wiki/auth/google-oauth.md และเชื่อมโยงสารบัญหลัก | Antigravity AI |
| 2026-06-18 | v1.8 | สร้างไฟล์ implemented-user-stories.md (reverse engineered จาก source code) รวบรวม 80+ implemented features ครอบคลุม Auth, QR Check-In, Events, Forms, Leaderboard, Shop, PDPA, Audit Log, Live Notifications, RBAC และ Cron Jobs พร้อม Role Matrix | Antigravity AI |
| 2026-06-18 | v1.7 | อัปเดตแผนงานและ changelog ให้สอดคล้องกับ features ที่ ship ไปหลัง Sprint 3 จบ (PR #33–51): major-based registration limit, Club/Major President scanner roles, scanner score deduction, pre-test gate & reset, form file upload (image/PDF) + GC sweep, staff onboarding bypass, live check-in/score notifications, Digital ID modal, QR dark-mode fix | Antigravity AI |
| 2026-06-24 | v2.1 | ปรับปรุง GDD ครั้งใหญ่: ยกระดับ docs/gdd/00-concept.md เป็น Platform Concept (WebRTC P2P + QR Code/Room Code entry + Extensible Game Modules), เขียน docs/gdd/01-mechanics.md ใหม่เป็น Platform Mechanics (WebRTC Signaling Flow, Hybrid architecture, Turn/Timer system, Fallback mode, Game Module Interface), และสร้าง docs/gdd/games/ox.md สำหรับ OX Game Design โดยเฉพาะ (Game State, Win Conditions, UI Mockups) | Developer |
| 2026-06-24 | v2.0 | สร้างชุดเอกสาร GDD ครั้งแรก: docs/gdd/00-concept.md และ docs/gdd/01-mechanics.md สำหรับ OX Battle | Developer |
| 2026-06-19 | v1.9 | อัปเดตความคืบหน้าการพัฒนาจาก Git Logs (PR #52–56): ระบบเช็คอินหลายวัน (Multi-day check-in), Custom Day selector ของสแกนเนอร์, เพิ่มปุ่ม LINE CTA และแบ่งหน้าสมาชิกบ้านทีละ 50 คน, ปรับปรุงสีประจำบ้านและรูปมาสคอตใหม่ทั้งหมด, และจำกัดสิทธิ์ SMO/ประธาน ในการเปิดดูเฉพาะรายชื่อผู้เข้าร่วมแบบสิทธิ์ดูอย่างเดียว (PDPA-safe Roster) | Antigravity AI |

---
*จัดทำขึ้นโดยระบบจัดการเอกสารการพัฒนา ActiveCAMT*
