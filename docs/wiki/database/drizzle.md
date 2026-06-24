# 🗄️ Drizzle ORM — Database Management & Guide

คู่มือทำความเข้าใจและการจัดการฐานข้อมูลในโครงการ **ActiveCAMT** โดยใช้ **Drizzle ORM** ร่วมกับ **PostgreSQL**

---

## 1. ภาพรวม (Overview)
**Drizzle ORM** เป็นเครื่องมือประเภท TypeScript-first ORM (Object-Relational Mapper) ที่ถูกเลือกใช้ในโครงการนี้เพื่อความเร็ว น้ำหนักเบา และมีความยืดหยุ่นในการเขียน Query เสมือนการเขียน SQL ดิบ (SQL-like syntax) แต่ยังคงมี Type Safety ของ TypeScript ที่สมบูรณ์แบบ

### จุดเด่นที่ใช้ในโครงการ:
* **Drizzle-kit:** ใช้ในการสร้าง/จัดการไฟล์ Migrations และตรวจสอบโครงสร้างฐานข้อมูล
* **Drizzle Schema:** การนิยามโครงสร้างฐานข้อมูลทั้งหมดไว้ในโค้ด TypeScript ที่จุดเดียว ([schema.ts](file:///c:/Users/noppon/sources/03_NAPLAB/smocamt-website/src/db/schema.ts))
* **Drizzle Studio:** หน้าจอเครื่องมือจัดการข้อมูลผ่านเบราว์เซอร์สำหรับงานประเภทหลังบ้าน/การทดสอบ

---

## 1.1 แนวคิด ORM และคุณสมบัติพื้นฐาน (What is ORM & Its Properties)
**ORM (Object-Relational Mapping)** คือเทคนิคการเขียนโปรแกรมเพื่อเชื่อมต่อและแปลงข้อมูลระหว่างระบบฐานข้อมูลแบบความสัมพันธ์ (Relational Database) กับระบบการเขียนโปรแกรมเชิงวัตถุ (Object-Oriented Programming - OOP) หรือโครงสร้างข้อมูลในโค้ด (เช่น Object/Types ใน TypeScript)

### คุณสมบัติหลักของ ORM (Core ORM Properties):
1. **Database Abstraction (การลดรูปความซับซ้อนของฐานข้อมูล):** แปลงตาราง (Tables) ให้กลายเป็น Class หรือ Object ในภาษาที่ใช้เขียนโปรแกรม ทำให้นักพัฒนาเข้าถึงข้อมูลได้โดยตรงผ่านคำสั่งของภาษานั้น ๆ โดยไม่ต้องเขียนคำสั่ง SQL ดิบในทุกจุด
2. **Type Safety & Validation:** ตรวจสอบโครงสร้างของข้อมูลตั้งแต่ขั้นตอนการเขียนโค้ด (Compile-time หรือ Build-time) ป้องกันปัญหาการสะกดชื่อฟิลด์ผิด หรือประเภทข้อมูลไม่ตรงกับฐานข้อมูลจริง
3. **Relationships Management (การจัดการความสัมพันธ์):** ช่วยจัดการการเชื่อมโยงข้อมูลข้ามตาราง (Relationships เช่น One-to-One, One-to-Many, Many-to-Many) ให้ทำได้ง่ายผ่านการนิยามความสัมพันธ์ในโค้ด ทำให้เขียนคำสั่ง Join หรือดึงข้อมูลที่เกี่ยวข้องได้ง่ายขึ้น
4. **Security & Parameterized Queries:** ป้องกันช่องโหว่ความปลอดภัยที่สำคัญ เช่น **SQL Injection** โดยระบบ ORM จะแปลงค่าตัวแปรใน Query ให้เป็น Parameterized Query (หรือ Prepared Statements) โดยอัตโนมัติ
5. **Schema Migration Management:** มีเครื่องมือช่วยบันทึกการเปลี่ยนแปลงโครงสร้างฐานข้อมูล (Schema) ในแต่ละเวอร์ชัน เพื่อให้ทีมพัฒนาและระบบ CI/CD สามารถอัปเดตสคีมาของฐานข้อมูลได้ตรงกันและปลอดภัย
6. **Dialect Independence:** ช่วยแปลงโค้ดคำสั่งคิวรีให้เหมาะสมกับระบบฐานข้อมูลที่เลือกใช้ (เช่น PostgreSQL, MySQL, SQLite) ทำให้นักพัฒนาใช้โค้ดชุดเดิมในการจัดการฐานข้อมูลที่ต่างกันได้บางส่วน

---

## 1.2 เจาะลึก Drizzle ORM และความแตกต่างจาก ORM แบบดั้งเดิม (Why Drizzle?)
แม้ ORM แบบดั้งเดิม (เช่น Prisma, Sequelize หรือ TypeORM) จะให้ความสะดวกสบายในการทำงานสูง แต่ก็มักจะมาพร้อมกับปัญหาด้านประสิทธิภาพ (Performance Overhead) และความยากในการเขียน Query ที่ซับซ้อน Drizzle ORM จึงถูกพัฒนาขึ้นมาภายใต้ปรัชญา **"If you know SQL, you know Drizzle ORM"**

### เปรียบเทียบคุณสมบัติและการทำงาน:

| คุณสมบัติ (Feature) | ORM แบบดั้งเดิม (เช่น Prisma / TypeORM) | Drizzle ORM |
| :--- | :--- | :--- |
| **ปรัชญาการคิวรี (Querying Philosophy)** | สร้าง Syntax หรือ API ชุดใหม่ขึ้นมาเฉพาะตัวเพื่อหลีกเลี่ยงการเขียน SQL | เลียนแบบโครงสร้างและรูปแบบคำสั่งของ SQL ดิบ (SQL-like syntax) |
| **ประสิทธิภาพ (Performance)** | ค่อนข้างช้ากว่าเนื่องจากมี Layer ในการแปลงข้อมูลและสร้าง Query ซับซ้อน (Prisma ใช้ Rust-engine ทำงานเบื้องหลัง) | เร็วมาก (ใกล้เคียงกับการใช้ Raw Database Driver) เนื่องจากไม่มี Engine เพิ่มเติมและโค้ดมีน้ำหนักเบามาก |
| **Type Safety** | จำเป็นต้องมีการ Build/Generate Types ลงใน `node_modules` เสมอ | อาศัยความสามารถของ TypeScript Type Inference (แกะประเภทข้อมูลจาก Schema ในโค้ดโดยตรง ไม่ต้องรัน build เสมอเพื่อตรวจสอบ Type) |
| **การควบคุมคำสั่ง SQL (Control)** | ยากต่อการปรับแต่งคำสั่ง SQL ที่ซับซ้อน เช่น Window Functions, Common Table Expressions (CTE) หรือการล็อกแถวเฉพาะเจาะจง | ทำได้ง่ายและยืดหยุ่นมาก เพราะโครงสร้างคำสั่งตรงกับ SQL จริง ทำให้ควบคุมพฤติกรรมฐานข้อมูลได้ละเอียด (เช่น การใช้ `for("update")`) |
| **การเชื่อมต่อฐานข้อมูล (Database Driver)** | ใช้ Engine ของตัวเองเชื่อมต่อ | ใช้ Driver ที่เป็นที่นิยมในฝั่ง Node.js/Bun โดยตรง (ในโครงการนี้เลือกใช้ `postgres` / Postgres-JS) ทำให้ตั้งค่า Connection Pool ได้แม่นยำ |
| **ขนาดของ Bundle (Bundle Size)** | มีขนาดใหญ่ ส่งผลต่อความเร็วในสภาพแวดล้อม Serverless | ขนาดเล็กมาก (Zero-dependency ในส่วน Core) เหมาะสำหรับ Serverless และ Edge Functions |

---

## 2. การกำหนดการเชื่อมต่อฐานข้อมูล (Database Connection)
การเชื่อมต่อถูกจัดการผ่านไลบรารี `postgres` (Postgres-JS) ในไฟล์ [src/db/index.ts](file:///c:/Users/noppon/sources/03_NAPLAB/smocamt-website/src/db/index.ts) โดยมีประเด็นสำคัญที่นักพัฒนาควรรู้ดังนี้:

### 2.1 ระบบป้องกันการแคชหลุด (Unhandled Rejection Guard)
ระบบมีฟังก์ชันควบคุมและเพิกเฉยต่อความผิดพลาดชั่วคราวจากการยกเลิกงานฐานข้อมูลกะทันหัน หรือข้อผิดพลาด Socket Connection เพื่อไม่ให้ระบบเซิร์ฟเวอร์ Next.js ดับ (Process crash)
```typescript
if (!globalForDb.errorGuardsInstalled) {
  process.on("unhandledRejection", (reason) => {
    console.error("[db] Unhandled promise rejection (suppressed to keep instance alive):", reason);
  });
  globalForDb.errorGuardsInstalled = true;
}
```

### 2.2 การปรับขนาด Connection Pool (`DB_POOL_MAX`)
* **เมื่อต่อผ่าน Supabase Transaction Pooler (พอร์ต 6543):** จะใช้ขนาด Pool เท่ากับ **5** เพื่อลดภาระและป้องกันไม่ให้ Connection บัญชีใช้งานร่วมกันเกินขีดจำกัด
* **เมื่อต่อตรงกับฐานข้อมูลอื่น / Self-Hosted (พอร์ต 5432):** จะขยายขนาด Pool สูงสุดขึ้นเป็น **15** (หรือปรับแต่งผ่าน Env Variable `DB_POOL_MAX`) เพื่อรองรับปริมาณ Concurrent request สูงในวันจัดกิจกรรมจริง

---

## 3. โครงสร้างและการอัปเดตสคีมา (Schema Definition)
โครงสร้างตารางข้อมูลทั้งหมดอยู่ในไฟล์ [src/db/schema.ts](file:///c:/Users/noppon/sources/03_NAPLAB/smocamt-website/src/db/schema.ts) 💡

### ตัวอย่างการเขียนสคีมาตาราง:
```typescript
export const houses = pgTable("houses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  points: integer("points").default(0),
});
```

---

## 4. คำสั่งควบคุมและ Migrations (CLI Commands)

สคริปต์สำหรับการจัดการฐานข้อมูลถูกระบุไว้ใน `package.json` ดังนี้:

* **สร้างไฟล์ SQL Migration:**
  ```bash
  npm run db:generate
  ```
  สร้างไฟล์อัปเดตโครงสร้างฐานข้อมูล (SQL files) ลงในโฟลเดอร์ `/drizzle` อิงจากความต่างระหว่างไฟล์โค้ด `schema.ts` และประวัติการ Migration ก่อนหน้า

* **รันระบบ Migration ไปยังฐานข้อมูล:**
  ```bash
  npm run db:migrate
  ```
  รันไฟล์สคริปต์ [src/db/migrate.ts](file:///c:/Users/noppon/sources/03_NAPLAB/smocamt-website/src/db/migrate.ts) เพื่อแปลงโครงสร้างของฐานข้อมูลจริง (Production/Local) ให้ตรงกับโค้ดล่าสุดอย่างปลอดภัยและมี Idempotency

* **อัปเดตโครงสร้างเข้า DB โดยตรง (เฉพาะโหมดพัฒนา):**
  ```bash
  npm run db:push
  ```
  อัปเดตโครงสร้างตารางฐานข้อมูลโดยตรงโดยไม่ต้องสร้างไฟล์ Migration (เหมาะสำหรับการพัฒนาระบบบนเครื่องตัวเองช่วงแรก)

* **เปิด Drizzle Studio (ดูและแก้ไขข้อมูลผ่านเว็บ):**
  ```bash
  npm run db:studio
  ```
  สตาร์ทเครื่องมือ UI จัดการฐานข้อมูลที่ `http://local.drizzle.studio`

---

## 5. รูปแบบการเขียน Query ที่พบบ่อย (Common Patterns)

### 5.1 การดึงข้อมูลแบบมีเงื่อนไขและ Joins (Select)
```typescript
import { db } from "@/db";
import { events, attendance } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const userAttendance = await db
  .select({
    eventId: attendance.eventId,
    eventTitle: events.title,
    checkInTime: attendance.checkInTime,
  })
  .from(attendance)
  .innerJoin(events, eq(attendance.eventId, events.id))
  .where(
    and(
      eq(attendance.studentId, studentId),
      eq(attendance.status, "attended")
    )
  );
```

### 5.2 การใช้ SQL Transaction ร่วมกับการใช้ Row Lock (`FOR UPDATE`)
เพื่อป้องกันปัญหาการแย่งลงทะเบียนสิทธิ์เกินโควต้าอันเนื่องมาจาก Race Condition ระบบได้ใช้ระบบล็อกแถวเป้าหมายใน Transaction เสมอ:

```typescript
await db.transaction(async (tx) => {
  // 1. ล็อกแถวของเซสชันที่ต้องการตรวจสอบโควต้าเพื่อกัน request อื่นเขียนแทรก
  const [session] = await tx
    .select()
    .from(eventSessions)
    .where(eq(eventSessions.id, sessionId))
    .for("update"); // <-- PostgreSQL FOR UPDATE lock

  // 2. ตรวจสอบโควต้าและบันทึกข้อมูลการเช็คอินลงตาราง
  // ... (โค้ดตรวจสอบเงื่อนไขความจุ)
  
  await tx.insert(attendance).values({
    sessionId,
    eventId,
    studentId,
    status: "attended",
  });
});
```

### 5.3 การใช้การจัดการ Upsert (ON CONFLICT)
ใช้หลีกเลี่ยงการเช็คอินซ้ำในระดับตารางฐานข้อมูล โดยกำหนดทางเลือกว่าหากตรวจเจอ key ซ้ำ (Conflict) ให้ข้ามคำสั่งไป (Do Nothing)
```typescript
await db
  .insert(attendance)
  .values({ sessionId, studentId, status: "attended" })
  .onConflictDoNothing({ target: [attendance.sessionId, attendance.studentId] });
```
