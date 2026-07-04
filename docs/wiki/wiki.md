# 🌐 ActiveCAMT — สารบัญข้อมูลความรู้และวิธีพัฒนา (Knowledge Wiki)

**อัปเดตล่าสุด:** 2026-06-18 | **ผู้รับผิดชอบดูแล:** ฝ่ายเทคโนโลยีโครงการ ActiveCAMT  
**ลิงก์ดัชนี:** [กลับหน้าหลัก](../index.md)

---

## 🎯 เข้าถึงแบบรวดเร็ว (Quick Access)
- **[เอกสารข้อกำหนดความต้องการระบบ (SRS)]**: [ภาษาไทย](../software/00-srs-th.md) / [ภาษาอังกฤษ](../software/00-srs-en.md)
- **[โครงสร้างและการออกแบบระบบย่อย]**: [System Design](../software/01-system-design.md)
- **[โครงสร้างและแผนผังสคีมาฐานข้อมูล]**: [Database Schema](../software/03-data-schema.md)
- **[แผนผังกระบวนการสแกนและการล็อกความปลอดภัย]**: [Process Flows](../software/02-class-diagram.md)
- **[ไทม์ไลน์และประวัติการพัฒนาแต่ละ Sprint]**: [Sprint Roadmap](../agile/02-sprint-planning.md)
- **[ข้อกำหนดความต้องการและสิทธิ์การใช้งาน]**: [Product Backlog](../agile/01-product-backlog.md)

---

## 🧠 ข้อมูลการตั้งค่าติดตั้งเซิร์ฟเวอร์ (Deployment Guides)
*เอกสารและคู่มือการนำระบบขึ้นเซิร์ฟเวอร์ใช้งานจริง (Production)*

- **[สถาปัตยกรรมการวางเซิร์ฟเวอร์]**: [Deployment Architecture](./development/deployment-architecture.md)
- **[คู่มือขั้นตอนการติดตั้ง Docker บน VM ของวิทยาลัย]**: [University Server Deployment Guide](./development/deployment-guide.md)

---

## 🔐 ระบบยืนยันตัวตนและความปลอดภัย (Authentication & Security)
*เจาะลึกระบบความปลอดภัยและการทำ OAuth*

- **[การถอดบทเรียนระบบ Google OAuth]**: [Google OAuth Guide](./auth/google-oauth.md) — รายละเอียดโครงสร้าง NextAuth v5, callbacks, trustHost และการจัดสรรภาระงานฐานข้อมูล

---

## 🗄️ ระบบฐานข้อมูลและการจัดการ (Database Management)
*คู่มือเครื่องมือสคีมาฐานข้อมูลและการจัดการ Migrations*

- **[คู่มือ Drizzle ORM ในโครงการ]**: [Drizzle ORM Guide](./database/drizzle.md) — แนะนำโครงสร้างสคีมา, คำสั่ง Migrations, Studio, การใช้ Connection Pooling และ SQL Transaction ร่วมกับ Row Lock (FOR UPDATE)

---

## 📄 เอกสารข้อเสนอโครงการและการงบประมาณ (Project Proposal & Budget)
*รายละเอียดการเสนอโครงการกับคณะผู้บริหารและการวางงบประมาณ*

- **[เอกสารข้อเสนอโครงการเพื่อขอทุนสนับสนุน]**: [project_proposal_th.md](./camt-fun/project_proposal_th.md) — แผนงานเชิงกลยุทธ์ ปัญหาของคณะผู้บริหาร และแผนงบประมาณโครงสร้างพื้นฐาน

---

## 📊 กฎเกณฑ์และข้อตกลงในการพัฒนา (Guidelines & Rules)
*ข้อตกลงและกฎทางธุรกิจที่ฝังในโค้ดระบบ*

- **[กติกาการให้คะแนนและคำนวณอันดับบ้าน]**: [Scoring & Ranking Rules](../scoring-rules.md) — คู่มือที่ใช้อ้างอิงการจัดอันดับและป้องกันข้อพิพาทคะแนนสะสม

---
*Powered by Antigravity Knowledge Management System for ActiveCAMT.*
