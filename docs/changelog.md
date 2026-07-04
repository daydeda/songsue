# Documentation Changelog

ประวัติการปรับปรุงและอัปเดตเอกสารระบบ **ActiveCAMT**

| วันที่ | เวอร์ชันเอกสาร | รายละเอียดการแก้ไข | ผู้รับผิดชอบ |
| :--- | :--- | :--- | :--- |
| 2026-07-04 | v2.6 | ย้ายชุดเอกสาร User Stories หมวดประสิทธิภาพ (US-PERF-21a ถึง US-PERF-21e) ไปจัดเก็บใน archives หลังยืนยันการทำระบบเสร็จสิ้น และอัปเดตลิงก์ดัชนีโครงการ | Antigravity AI |
| 2026-07-02 | v2.5 | อัปเดตสถานะและ Acceptance Criteria ของ User Stories กลุ่ม US-FIX (US-FIX-20a ถึง US-FIX-20i) เป็น Implemented ตามพฤติกรรมการทำงานจริงของ Source Code | Antigravity AI |
| 2026-07-02 | v2.4 | จัดทำเอกสารสรุปความคืบหน้าการพัฒนาหลังการรวมสาขา (Merge origin/main into report) ใน updates/2026-07-02.md ครอบคลุมระบบปฏิทินแบบทำซ้ำ, ระบบแจ้งเตือนกิจกรรมแบบ Live, การแก้ไขการแสดงผลกล้อง Scanner, ตัวกรองข้อมูลระดับการศึกษาและปีการศึกษา และระบบเกม P2P Battle (OX Game Engine + Drizzle setup) | Antigravity AI |
| 2026-06-25 | v2.3 | ปรับปรุงระบบเอกสารการออกแบบและพัฒนา (docs/software และ docs/features) ให้สอดคล้องกับระบบจริง, จัดทำคู่มือ Drizzle ORM, และพัฒนาสคริปต์ run-local.ps1 เพื่อใช้รันระบบและตรวจสอบไลบรารีบน Local | Antigravity AI |
| 2026-06-25 | v2.2 | จัดทำเอกสารสรุปความคืบหน้าการพัฒนาและรายงานการพัฒนา (updates/2026-06-24_to_06-25.md) รวบรวมฟีเจอร์เด่นระบบปฏิทินรายเดือน การเชื่อมต่อ .ics feed, แถบสถิติสะสมแดชบอร์ด, หน้าจอแจ้งย้ายระบบ Vercel, และการปรับปรุงประสิทธิภาพ/ระบบ Deploy และการแปลภาษา | Antigravity AI |
| 2026-06-24 | v2.1 | ปรับปรุง GDD ครั้งใหญ่: ยกระดับ docs/gdd/00-concept.md เป็น Platform Concept (WebRTC P2P + QR Code/Room Code entry + Extensible Game Modules), เขียน docs/gdd/01-mechanics.md ใหม่เป็น Platform Mechanics (WebRTC Signaling Flow, Hybrid architecture, Turn/Timer system, Fallback mode, Game Module Interface), และสร้าง docs/gdd/games/ox.md สำหรับ OX Game Design โดยเฉพาะ (Game State, Win Conditions, UI Mockups) | Developer |
| 2026-06-24 | v2.0 | สร้างชุดเอกสาร GDD ครั้งแรก: docs/gdd/00-concept.md และ docs/gdd/01-mechanics.md สำหรับ OX Battle | Developer |
| 2026-06-19 | v1.9 | อัปเดตความคืบหน้าการพัฒนาจาก Git Logs (PR #52–56): ระบบเช็คอินหลายวัน (Multi-day check-in), Custom Day selector ของสแกนเนอร์, เพิ่มปุ่ม LINE CTA และแบ่งหน้าสมาชิกบ้านทีละ 50 คน, ปรับปรุงสีประจำบ้านและรูปมาสคอตใหม่ทั้งหมด, และจำกัดสิทธิ์ SMO/ประธาน ในการเปิดดูเฉพาะรายชื่อผู้เข้าร่วมแบบสิทธิ์ดูอย่างเดียว (PDPA-safe Roster) | Antigravity AI |
| 2026-06-18 | v1.8 | สร้างไฟล์ implemented-user-stories.md (reverse engineered จาก source code) รวบรวม 80+ implemented features ครอบคลุม Auth, QR Check-In, Events, Forms, Leaderboard, Shop, PDPA, Audit Log, Live Notifications, RBAC และ Cron Jobs พร้อม Role Matrix | Antigravity AI |
| 2026-06-18 | v1.7 | อัปเดตแผนงานและ changelog ให้สอดคล้องกับ features ที่ ship ไปหลัง Sprint 3 จบ (PR #33–51): major-based registration limit, Club/Major President scanner roles, scanner score deduction, pre-test gate & reset, form file upload (image/PDF) + GC sweep, staff onboarding bypass, live check-in/score notifications, Digital ID modal, QR dark-mode fix | Antigravity AI |
| 2026-06-18 | v1.6 | ย้ายเอกสารถอดบทเรียนระบบ Google OAuth ไปจัดเก็บใน docs/wiki/auth/google-oauth.md และเชื่อมโยงสารบัญหลัก | Antigravity AI |
| 2026-06-18 | v1.5 | จัดทำและแตกรายละเอียดโครงงานย่อย (User Stories) ของ Sprint 05 (US-GAME-18a ถึง 18i) และ Sprint 06 (US-OPT-19a ถึง 19f) ครบถ้วน | Antigravity AI |
| 2026-06-18 | v1.4 | จัดทำ Sprint Backlogs (Sprint 4, 5, 6) และแตกรายละเอียด User Stories ย่อย (US-PWA-17a ถึง US-PWA-17d) สำหรับเตรียมการพัฒนาระบบ | Antigravity AI |
| 2026-06-18 | v1.3 | เพิ่ม Product Backlog หมวด 1.6 (Optimization: US-OPT-19a–19f) และ Sprint 6 ในแผนงาน สำหรับ Performance & API Cache Optimization (Events cache, JWT major, hot-path cleanup, Core Web Vitals) | Antigravity AI |
| 2026-06-18 | v1.2 | เพิ่ม Product Backlog หมวด 1.5 (Game: US-GAME-18a–18i) และ Sprint 5 ในแผนงาน สำหรับ Feature Multi-Interactive Game Session (Quiz / Mini-game / Live Poll) | Antigravity AI |
| 2026-06-18 | v1.1 | เพิ่ม Product Backlog หมวด 1.4 (PWA: US-PWA-17a–17d) และ Sprint 4 ในแผนงาน สำหรับ Feature Progressive Web App | Antigravity AI |
| 2026-06-18 | v1.0 | จัดทำชุดเอกสารการพัฒนา (Development Documentation) ครั้งแรก ครอบคลุม System Design, Class/Process Flows, Data Schema, Backlog, Sprint Roadmap และ Wiki | Antigravity AI |

---
*จัดทำขึ้นโดยระบบจัดการเอกสารการพัฒนา ActiveCAMT*
