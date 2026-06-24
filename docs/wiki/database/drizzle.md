# 🗄️ Drizzle ORM — Database Management & Guide

คู่มือทำความเข้าใจและการจัดการฐานข้อมูลในโครงการ **ActiveCAMT** โดยใช้ **Drizzle ORM** ร่วมกับ **PostgreSQL**

---

## 1. ภาพรวม (Overview)
**Drizzle ORM** เป็นเครื่องมือประเภท TypeScript-first ORM (Object-Relational Mapper) ที่ถูกเลือกใช้ในโครงการนี้เพื่อความเร็ว น้ำหนักเบา และมีความยืดหยุ่นในการเขียน Query เสมือนการเขียน SQL ดิบ (SQL-like syntax) แต่ยังคงมี Type Safety ของ TypeScript ที่สมบูรณ์แบบ

### จุดเด่นที่ใช้ในโครงการ:
* **Drizzle-kit:** ใช้ในการสร้าง/จัดการไฟล์ Migrations และตรวจสอบโครงสร้างฐานข้อมูล
* **Drizzle Schema:** การนิยามโครงสร้างฐานข้อมูลทั้งหมดไว้ในโค้ด TypeScript ที่จุดเดียว ([schema.ts](../../../src/db/schema.ts))
* **Drizzle Studio:** หน้าจอเครื่องมือจัดการข้อมูลผ่านเบราว์เซอร์สำหรับงานประเภทหลังบ้าน/การทดสอบ

---

## 2. การกำหนดการเชื่อมต่อฐานข้อมูล (Database Connection)
การเชื่อมต่อถูกจัดการผ่านไลบรารี `postgres` (Postgres-JS) ในไฟล์ [src/db/index.ts](../../../src/db/index.ts) โดยมีประเด็นสำคัญที่นักพัฒนาควรรู้ดังนี้:

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
โครงสร้างตารางข้อมูลทั้งหมดอยู่ในไฟล์ [src/db/schema.ts](../../../src/db/schema.ts) 

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
  รันไฟล์สคริปต์ [src/db/migrate.ts](../../../src/db/migrate.ts) เพื่อแปลงโครงสร้างของฐานข้อมูลจริง (Production/Local) ให้ตรงกับโค้ดล่าสุดอย่างปลอดภัยและมี Idempotency

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
