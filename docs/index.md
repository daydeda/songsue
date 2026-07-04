# 🏠 ActiveCAMT — สารบัญเอกสารการพัฒนาโครงการ (Project Index)

**Project:** ActiveCAMT (Real-Time Activity & Digital House Points Management Platform)  
**Status:** Completed (เสร็จสิ้นการพัฒนาในเวอร์ชัน 1.2)  
**Last Updated:** 2026-06-18  
**Knowledge Hub:** [Project Wiki](./wiki/wiki.md)

---

## 🎮 Game Design (GDD) — P2P Battle Platform
- [00-concept.md](./gdd/00-concept.md) — ภาพรวม Platform (WebRTC P2P + QR/Code Entry + Game Registry + DB Schema)
- [01-mechanics.md](./gdd/01-mechanics.md) — กลไก Platform (WebRTC Signaling Flow, Turn System, Timer, Fallback Mode, Game Module Interface)
- **Game Modules:**
  - [games/ox.md](./gdd/games/ox.md) — OX (Tic-Tac-Toe) — Game Module แรก (MVP)

---

## 💻 Software Design
- [00-srs-th.md](./software/00-srs-th.md) / [00-srs-en.md](./software/00-srs-en.md) — เอกสารข้อกำหนดความต้องการระบบ (Software Requirements Specification)
- [01-system-design.md](./software/01-system-design.md) — โครงสร้างและโมดูลระบบย่อย (Subsystem Breakdown)
- [02-class-diagram.md](./software/02-class-diagram.md) — แผนผังความสัมพันธ์และการไหลข้อมูล (Process Flows & Relationships)
- [03-data-schema.md](./software/03-data-schema.md) — โครงสร้างฐานข้อมูล Drizzle Schema (Database Schema & Security)

---

## 💡 Feature Specifications (เอกสารระบุคุณสมบัติเฉพาะ)
- [multi-day-checkin-implementation.md](./features/multi-day-checkin-implementation.md) — รายละเอียดระบบการเช็คอินแบบหลายวัน (Multi-Day Check-in)
- [calendar-and-ics-feed.md](./features/calendar-and-ics-feed.md) — ระบบปฏิทินแสดงผลรายเดือนและการส่งออกปฏิทินภายนอก (.ics feed)
- [form-reopening-points-clawback.md](./features/form-reopening-points-clawback.md) — ระบบดึงคะแนนรางวัลบ้านคืนเมื่อมีการเปิดแบบประเมินประเมินผลอีกครั้ง
- [multi-day-points-policy.md](./features/multi-day-points-policy.md) — [DRAFT] นโยบายและเกณฑ์คะแนนแบบละเอียดสำหรับกิจกรรมหลายวัน
- [multi-day-partial-attendance.md](./features/multi-day-partial-attendance.md) — [DRAFT] นโยบายและการจัดการกรณีผู้เรียนมาเข้าร่วมไม่ครบทุกวัน

---

## 🚀 Agile Management
- [01-product-backlog.md](./agile/01-product-backlog.md) — รายการฟีเจอร์และ User Stories (Product Backlog)
- [02-sprint-planning.md](./agile/02-sprint-planning.md) — แผนงานการพัฒนาและไทม์ไลน์การอัปเดต (Release Timeline & Gantt)
- **Sprint Backlogs:**
  - [Sprint 04 Backlog (PWA)](./agile/sprint-backlogs/sprint-04.md) — แผนงานระยะที่ 4 (Add to Home Screen, Offline, Camera OS compatibility)
  - [Sprint 05 Backlog (Interactive Game)](./agile/sprint-backlogs/sprint-05.md) — แผนงานระยะที่ 5 (Real-time Socket.IO, Quiz & Poll, Projector Screen)
  - [Sprint 06 Backlog (Performance)](./agile/sprint-backlogs/sprint-06.md) — แผนงานระยะที่ 6 (Server Cache, JWT Optimization, Core Web Vitals)
- [implemented-user-stories.md](./agile/implemented-user-stories.md) — **สรุป User Stories ที่พัฒนาแล้วทั้งหมด** (reverse engineered จาก source code, 80+ features)
- **User Stories (Planned):**
  - **Sprint 4 (PWA):** [US-PWA-17a](./agile/user-stories/archives/US-PWA-17a.md) | [US-PWA-17b](./agile/user-stories/archives/US-PWA-17b.md) | [US-PWA-17c](./agile/user-stories/archives/US-PWA-17c.md) | [US-PWA-17d](./agile/user-stories/archives/US-PWA-17d.md)
  - **Sprint 5 (Game):** [US-GAME-18a](./agile/user-stories/archives/US-GAME-18a.md) | [US-GAME-18b](./agile/user-stories/archives/US-GAME-18b.md) | [US-GAME-18c](./agile/user-stories/archives/US-GAME-18c.md) | [US-GAME-18d](./agile/user-stories/archives/US-GAME-18d.md) | [US-GAME-18e](./agile/user-stories/archives/US-GAME-18e.md) | [US-GAME-18f](./agile/user-stories/archives/US-GAME-18f.md) | [US-GAME-18g](./agile/user-stories/archives/US-GAME-18g.md) | [US-GAME-18h](./agile/user-stories/archives/US-GAME-18h.md) | [US-GAME-18i](./agile/user-stories/archives/US-GAME-18i.md)
  - **Sprint 6 (Performance):** [US-OPT-19a](./agile/user-stories/archives/US-OPT-19a.md) | [US-OPT-19b](./agile/user-stories/archives/US-OPT-19b.md) | [US-OPT-19c](./agile/user-stories/archives/US-OPT-19c.md) | [US-OPT-19d](./agile/user-stories/archives/US-OPT-19d.md) | [US-OPT-19e](./agile/user-stories/archives/US-OPT-19e.md) | [US-OPT-19f](./agile/user-stories/archives/US-OPT-19f.md)
  - **Sprint 5 (P2P Performance Epic):** [US-PERF-21a](./agile/user-stories/archives/US-PERF-21a.md) | [US-PERF-21b](./agile/user-stories/archives/US-PERF-21b.md) | [US-PERF-21c](./agile/user-stories/archives/US-PERF-21c.md) | [US-PERF-21d](./agile/user-stories/archives/US-PERF-21d.md) | [US-PERF-21e](./agile/user-stories/archives/US-PERF-21e.md)

---

## 📚 Resources & Guidelines
- [Project Wiki](./wiki/wiki.md) — คลังข้อมูลกลางและเอกสารคู่มือพัฒนา/ติดตั้ง
- [Google OAuth Guide](./wiki/auth/google-oauth.md) — เอกสารถอดบทเรียนระบบ Google OAuth (NextAuth v5)
- [Project Proposal](./wiki/camt-fun/project_proposal_th.md) — เอกสารข้อเสนอโครงการเพื่อขอทุนสนับสนุนและการวางงบประมาณ
- [Scoring Rules](./scoring-rules.md) — กฎเกณฑ์การคิดคะแนนระบบบ้านและนักศึกษารายบุคคล
- [run-local.ps1](../run-local.ps1) — สคริปต์ PowerShell สำหรับเช็คความพร้อม ติดตั้งไลบรารี และรันระบบทดสอบระดับ Local แบบรวดเร็ว
- [Documentation Changelog](./changelog.md) — ประวัติการปรับปรุงเอกสาร

---
*จัดทำขึ้นโดยระบบจัดการเอกสารการพัฒนา ActiveCAMT*
