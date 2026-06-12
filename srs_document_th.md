# เอกสารข้อกำหนดความต้องการซอฟต์แวร์ (Software Requirements Specification — SRS)

**ชื่อระบบ:** แพลตฟอร์มจัดการกิจกรรมและคะแนนบ้านแบบ real-time (ActiveCAMT)
**เวอร์ชัน:** 1.1 (เพิ่มระบบฟอร์ม KAS, QR แบบ HMAC, audit log กันแก้แบบ hash chain, leaderboard รายบุคคล, โควต้า/ช่วงเวลาลงทะเบียน และโปสเตอร์หลายรูปต่อกิจกรรม)
**อัปเดตล่าสุด:** 12 มิถุนายน 2569
**สถานะ:** เสร็จแล้ว (พร้อมเสนอกรรมการและ admin ระบบ)

---

## 1. บทนำ (Introduction)

### 1.1 วัตถุประสงค์ (Purpose)
เอกสารนี้อธิบายรายละเอียดทางเทคนิค, functional requirements และ non-functional requirements ของโปรเจกต์ **ActiveCAMT** เพื่อให้การจัดกิจกรรมของมหาวิทยาลัยทำงานได้โปร่งใส ปลอดภัย และมีประสิทธิภาพมากขึ้น

### 1.2 ขอบเขตระบบ (System Scope)
ระบบเป็น Modular Monolith รันบน Next.js 16 (App Router) แบ่งความสามารถหลักเป็นกลุ่มดังนี้:

* **จัดการผู้ใช้และสิทธิ์:** onboarding นักศึกษาใหม่, เก็บข้อมูลสุขภาพตาม PDPA และ role หลายระดับ (student, prof, officer, admin, super_admin)
* **ลงทะเบียนและเช็คอิน:** Dynamic QR เซ็นด้วย HMAC (อายุ 5 นาที), scanner เช็คอินแบบสองขั้น (Scan → Confirm), ช่วงเวลาเปิด/ปิดลงทะเบียน และโควต้าหลายชั้น (โควต้ารวม, โควต้าแยกไทย/อินเตอร์ และโควต้า Walk-in แบบบวกเพิ่ม)
* **ระบบฟอร์ม KAS:** หนึ่งกิจกรรมมีหลายฟอร์ม (K_pre, K_post, A, S) หน้าตาแบบ Google Forms มี section, branching ตามคำตอบ, ให้คะแนนแบบ quiz, ปิด/มอบคะแนนอัตโนมัติตามเวลา และ export XLSX
* **คะแนนและ leaderboard:** สะสมคะแนนบ้านและคะแนนรายบุคคลแบบ real-time มีอันดับของตัวเอง (self-rank) และสถานะ "ยังไม่ถูกจัดอันดับ" (Unranked)
* **ความปลอดภัยและการตรวจสอบ:** audit log กันแก้ย้อนหลัง (tamper-evident แบบ SHA256 hash chain), security headers/CSP และกรองข้อมูลตามสิทธิ์ให้เป็นไปตาม PDPA
* **ประสบการณ์ผู้ใช้:** โปสเตอร์หลายรูปปัดได้ (swipeable carousel) ซูมเต็มจอ (pinch/double-tap/wheel) และรองรับ 4 ภาษา (EN, TH, MM, CN)

---

## 2. โครงสร้างโปรเจกต์และการแบ่งไฟล์ (Project Architecture & Codebase Structure)

ActiveCAMT วางโครงสร้างตามมาตรฐาน ESM, TypeScript strict mode และใช้ path alias (`@/*` ชี้ไป `src/*`) ดังนี้:

```
src/
  ├── app/                        <── [Routing & Controllers]
  │   ├── layout.tsx              <── layout หลักและ HTML wrapper
  │   ├── page.tsx                <── landing page และตัวคัดกรอง login
  │   ├── globals.css             <── CSS รวมศูนย์แบบ CSS-first (Tailwind v4)
  │   ├── onboarding/             <── หน้ากรอกประวัติครั้งแรกของนักศึกษาใหม่
  │   ├── dashboard/              <── dashboard ฝั่งนักศึกษา
  │   │   ├── page.tsx            <── หน้าแรก dashboard โชว์ QR และสถิติ
  │   │   ├── profile/            <── แก้โปรไฟล์และช่องกรอกข้อมูลสุขภาพแบบ dynamic
  │   │   ├── history/            <── ประวัติกิจกรรม + แบบประเมิน
  │   │   └── houses/             <── leaderboard บ้านและประวัติคะแนน
  │   ├── admin/                  <── ฝั่ง admin / เจ้าหน้าที่
  │   │   ├── layout.tsx          <── layout + เมนู และ guard สิทธิ์ฝั่ง admin
  │   │   ├── dashboard/          <── สรุปสถิติเช็คอินและ feed แบบ real-time
  │   │   ├── events/             <── จัดการกิจกรรมและ form builder
  │   │   ├── students/           <── ค้นรายชื่อและดูข้อมูลสุขภาพนักศึกษา
  │   │   ├── scanner/            <── หน้ากล้องสแกน QR เช็คอิน
  │   │   └── audit-logs/         <── log ความปลอดภัยย้อนหลัง แก้/ลบไม่ได้
  │   └── api/                    <── [Route Handlers]
  │       ├── auth/               <── NextAuth
  │       ├── upload/             <── จัดการ upload ไฟล์ (จำกัด 5MB)
  │       ├── realtime/           <── stream ข้อมูล real-time ผ่าน SSE
  │       └── admin/...           <── route เฉพาะ admin
  ├── components/                 <── [Reusable UI Components]
  ├── db/                         <── [Database & ORM]
  │   ├── schema.ts               <── นิยาม schema ของ Drizzle
  │   └── index.ts                <── จุดเชื่อม DB ส่วนกลาง (PostgreSQL client)
  ├── lib/                        <── [Helpers / Utilities]
  │   ├── i18n.ts                 <── dictionary คำแปล 4 ภาษา (EN, TH, MM, CN)
  │   ├── LanguageContext.tsx     <── context จัดการภาษาฝั่ง client
  │   └── realtime-emitter.ts     <── broker ส่งสัญญาณข้าม worker thread ผ่านดิสก์
  └── modules/                    <── [Service Layer / Business Logic]
      ├── users/                  <── service จัดการ user และสิทธิ์
      ├── events/                 <── service โควต้าและตรวจสอบการเช็คอิน
      ├── houses/                 <── service คำนวณคะแนนและ leaderboard
      └── audit/                  <── service เขียน audit log
```

---

## 3. รายละเอียดไฟล์และการทำงาน (Comprehensive File Directory)

ด้านล่างเป็นการแจกแจงหน้าที่ของไฟล์หลักแต่ละตัวในระบบ เพื่อให้ตรวจสอบเชิงลึกได้:

### 3.1 ไฟล์ระบบ ความปลอดภัย และ config กลาง (Configuration & Auth)

#### 📂 [src/auth.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/auth.ts)
* **หน้าที่หลัก:** จัดการ login, ยืนยันตัวตน และ session ผ่าน NextAuth v5 (beta) ร่วมกับ Google provider และ `@auth/drizzle-adapter`
* **logic ภายใน:**
  * จำกัด login เฉพาะอีเมลที่ลงท้าย `@cmu.ac.th`
  * เก็บ `role` (student, prof, officer, admin) ลงใน JWT
  * **[CRITICAL] sync session แบบ dynamic:** ใน `jwt` callback ดักสัญญาณ `trigger === "update"` เพื่อเขียน session cookie ใหม่ทันทีหลังนักศึกษา onboarding หรือแก้โปรไฟล์เสร็จ ทำให้เข้า dashboard ได้เลยโดยไม่ต้อง log out เพื่อ refresh สิทธิ์ใหม่
  * กำหนด option การ auth และอายุ session (session expiry)

#### 📂 [src/db/schema.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/db/schema.ts)
* **หน้าที่หลัก:** นิยาม schema ของตารางในฐานข้อมูลด้วย TypeScript ผ่าน Drizzle ORM
* **logic ภายใน:**
  * ตาราง `users` เก็บ role หลายระดับ (`roles`), รูปโปรไฟล์, สถานะโปรไฟล์ (`profileCompleted`) และ **ข้อมูลสุขภาพตาม PDPA เก็บเป็นฟิลด์เข้ารหัสในตาราง users โดยตรง** (โรคประจำตัว `chronicDiseases`, ประวัติการรักษา `medicalHistory`, ยาที่แพ้ `drugAllergies`, อาหารที่แพ้ `foodAllergies`, ประวัติเป็นลม `faintingHistory`, ยาฉุกเฉิน `emergencyMedication`, ผู้ติดต่อฉุกเฉิน `emergencyContacts`) ไม่ได้แยกตารางต่างหาก
  * ตาราง `auditLogs` สำหรับ log ความปลอดภัยแบบ **append-only กันแก้ (tamper-evident)** — แต่ละแถวร้อยกันด้วย hash chain SHA256 (`prevHash`/`rowHash`) ไม่มี UPDATE หรือ DELETE และตั้งใจไม่ผูก foreign key บน `actorId`/`targetId` เพื่อให้ chain ไม่ขาดแม้ user จะถูกลบ
  * ตาราง `events` (เวลาเริ่ม/จบ, ช่วงเปิด/ปิดลงทะเบียน, โควต้ารวม/ไทย/อินเตอร์/Walk-in, กลุ่มเป้าหมาย, role ที่อนุญาต และโปสเตอร์หลายรูป `imageUrls`), `attendance` (บันทึกลงทะเบียน/เช็คอินพร้อม unique index กันลงซ้ำ), `houses` (คะแนนบ้าน) และ `scoreHistory` (ประวัติการปรับคะแนนและโบนัสบ้าน)
  * ตาราง `forms` และ `formSubmissions` สำหรับระบบฟอร์ม KAS — เก็บประเภทฟอร์ม (`formType`), โครงสร้างคำถามแบบ section/branching (`questions` v2), เวลาเปิด/ปิด (`opensAt`/`closesAt`), สถานะมอบคะแนน (`isAwarded`) และ unique index (form_id, student_id) กันส่งซ้ำเพื่อ farm คะแนน

#### 📂 [src/db/index.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/db/index.ts)
* **หน้าที่หลัก:** สร้าง connection ไปยังฐานข้อมูล PostgreSQL
* **logic ภายใน:**
  * อ่าน `DATABASE_URL` จาก env (.env)
  * ใช้ไลบรารี `postgres` ร่วมกับ Drizzle ORM
  * **[PERFORMANCE] connection pool:** จัดการ connection แบบ singleton กัน max connection limit เกิน ตอนที่นักศึกษาเข้าใช้พร้อมกันหลายคน

---

### 3.2 ไฟล์ฝั่ง client และฟอร์ม (Client-Side Pages & Forms)

#### 📂 [src/app/onboarding/page.tsx](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/app/onboarding/page.tsx)
* **หน้าที่หลัก:** หน้ากรอกข้อมูลครั้งแรกของนักศึกษาใหม่ แบ่งเป็นฟอร์ม 3 ส่วน รองรับ 4 ภาษา
* **logic ภายใน:**
  * **input constraints:**
    * รหัสนักศึกษา: regex ให้พิมพ์เฉพาะตัวเลข `0-9` และจำกัดความยาว 9 หลัก
    * เบอร์โทรและเบอร์ฉุกเฉิน: รับเฉพาะตัวเลข ยาว 10 หลัก
    * ข้อจำกัดทางอาหาร: ถ้าเลือก "อื่น ๆ" (Other) ช่องกรอกรายละเอียดจะโผล่ขึ้นมาผ่าน state (`dietaryRestrictionsOther`)
  * **[NEW] เช็คขนาดรูป 5MB ฝั่ง client:** ใน `handleImageUpload` จะอ่าน `file.size` ก่อนส่งขึ้น server ถ้าเกิน `5 * 1024 * 1024` ไบต์ จะ cancel การ upload แล้วขึ้น error `t.fileTooLarge` ทันที

#### 📂 [src/app/dashboard/profile/page.tsx](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/app/dashboard/profile/page.tsx)
* **หน้าที่หลัก:** หน้าแก้ข้อมูลส่วนตัวและประวัติสุขภาพของนักศึกษา
* **logic ภายใน:**
  * โหลดข้อมูลสุขภาพและเบอร์เดิมมาใส่ในฟอร์มเพื่อแก้
  * ล็อกรหัสนักศึกษา (แก้ไม่ได้หลังลงทะเบียน เพื่อความปลอดภัยของระบบสิทธิ์)
  * เช็คเบอร์มือถือและเบอร์ฉุกเฉินให้รับเฉพาะตัวเลข 10 หลัก
  * **[NEW] 5MB upload guard + auto-clear error:** กันการ upload ไฟล์เกิน 5MB โดยเช็คขนาดและเตือนก่อน พร้อมเคลียร์ error เดิมตอนเลือกไฟล์ใหม่

#### 📂 [src/app/dashboard/history/page.tsx](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/app/dashboard/history/page.tsx)
* **หน้าที่หลัก:** หน้ารวมประวัติกิจกรรมของนักศึกษา พร้อมระบบแบบประเมิน
* **logic ภายใน:**
  * **[FIX] epoch date validation:** กันไม่ให้ขึ้นวันที่ 1 January 1970 ตอนที่ยังไม่เช็คอิน (check_in_time เป็น null) โดยใช้เวลาเปิดงานมาแสดงแทน
  * **[NEW] attendance warning modal:** ตอนกดปุ่ม "ส่งแบบประเมิน" (เปลี่ยน icon เป็น `<ClipboardList />` กันงง) ระบบจะเช็คสถานะเช็คอินก่อน ถ้าไม่เจอประวัติการสแกนจริง จะล็อกไม่ให้เปิด/ส่งฟอร์ม แล้วเด้ง modal สีแดงบอกเหตุผลเป็นภาษาของนักศึกษา
  * **dynamic form fields renderer:** render คำถามจากฝั่ง admin ครบทุกแบบ ทั้ง text ยาว, rating ดาว, choice เลือกเดียว และ checkbox หลายตัวเลือก

---

### 3.3 ไฟล์ฝั่ง backend และการจัดการสิทธิ์ (Backend API Route Handlers)

#### 📂 [src/app/api/upload/route.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/app/api/upload/route.ts)
* **หน้าที่หลัก:** ตรวจสอบและเก็บรูปโปสเตอร์กิจกรรมและรูปโปรไฟล์ลงดิสก์ `/public/uploads/`
* **logic ภายใน:**
  * เช็ค session NextAuth กันคนนอกระบบ/บอทเรียกใช้
  * ตรวจ MIME type และนามสกุลไฟล์ (`.jpg`, `.png`, `.webp` ฯลฯ) กัน stored XSS
  * **[NEW — server-side limit] กันไฟล์เกิน 5MB:**
    ```typescript
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds the 5MB limit." }, { status: 400 });
    }
    ```
    ถ้ามีคนข้าม validation ฝั่ง client มาด้วยไฟล์ดิบขนาดใหญ่ ฝั่ง server จะยกเลิกการเขียนไฟล์และตอบ 400 Bad Request

#### 📂 [src/app/api/realtime/route.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/app/api/realtime/route.ts)
* **หน้าที่หลัก:** ทำ Server-Sent Events (SSE) แบบ persistent ส่ง stream การเปลี่ยนแปลงไปยัง browser ของผู้ใช้
* **logic ภายใน:**
  * ส่งแบบ streaming ผ่าน keep-alive และส่ง heartbeat ping ทุก 15 วินาที กัน proxy ตัด connection
  * **[CRITICAL SECURITY] PDPA filter (กรองข้อมูลตามสิทธิ์):**
    * ถ้าเป็น **admin** จะได้ข้อมูลกิจกรรมทั้งหมด (ชื่อคนเช็คอิน, ประวัติ admin, รายการคะแนน)
    * ถ้าเป็น **student** filter จะตัดชื่อคนเช็คอินคนอื่นและข้อมูลละเอียดออกหมด เหลือแค่คะแนนสะสมของบ้านและสัญญาณว่ามีกิจกรรมใหม่ ตามข้อกำหนด PDPA

#### 📂 [src/lib/realtime-emitter.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/lib/realtime-emitter.ts)
* **หน้าที่หลัก:** broker ส่งข้อความข้าม process (cross-process IPC) เพื่อข้ามข้อจำกัดเรื่องการแยก memory ของ Next.js worker thread
* **logic ภายใน:**
  * Next.js แยก process กัน (isolation) ทำให้ event emitter แบบ in-memory ปกติส่งข้ามกันไม่ได้
  * ไฟล์นี้แก้โดยเขียนข้อความสั้น ๆ ลงดิสก์ `/scratch/realtime-events/` แล้วใช้ `fs.watch` คอยดู เมื่อเจอไฟล์ใหม่ก็ push เข้า SSE แล้ว unlink ไฟล์ทิ้งทันที

---

### 3.4 ชั้น business logic ภายใน (Modules & Services Layer)

#### 📂 [src/modules/audit/audit.service.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/modules/audit/audit.service.ts)
* **หน้าที่หลัก:** service เขียน log การกระทำต่าง ๆ เพื่อความปลอดภัยและเอาไปแสดงในหน้า audit ของ admin
* **logic ภายใน:**
  * `logAction` รับรายละเอียดเหตุการณ์, IP address และชื่อผู้กระทำ แล้วเขียนลงตาราง `auditLogs`
  * บล็อก UPDATE และ DELETE เพื่อให้ log แก้ไม่ได้ (immutable)

#### 📂 [src/modules/users/users.service.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/modules/users/users.service.ts)
* **หน้าที่หลัก:** จัดการข้อมูล user, role และการเข้าถึงข้อมูลสุขภาพส่วนตัว
* **logic ภายใน:**
  * ดึงข้อมูลส่วนตัวของนักศึกษามาแสดงในหน้าค้นหา
  * encrypt/decrypt ฟิลด์ข้อมูลสุขภาพตอนเขียนหรืออ่าน

#### 📂 [src/modules/houses/houses.service.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/modules/houses/houses.service.ts)
* **หน้าที่หลัก:** service คำนวณคะแนนบ้านและอัปเดต leaderboard
* **logic ภายใน:**
  * คำนวณอันดับบ้านแบบ real-time และส่งสัญญาณ IPC ไปยัง SSE เมื่อคะแนนบ้านอัปเดต

#### 📂 [src/modules/events/scanner.service.ts](file:///E:/OnlyWork/SMO Meetings/Web/activecamt/src/modules/events/scanner.service.ts)
* **หน้าที่หลัก:** logic การสแกนและบันทึกเวลาเข้าร่วมกิจกรรม
* **logic ภายใน:**
  * ตรวจสอบ dynamic QR token ของนักศึกษา
  * กันสแกนซ้ำ, บันทึกเวลา และส่งสัญญาณ IPC ไป SSE เพื่ออัปเดตผลเช็คอินไปยัง browser ของ admin แบบทันที

---

### 3.5 ระบบฟอร์ม KAS (KAS Multi-Form System)

* **ไฟล์หลัก:** `src/lib/form-schema.ts` (core logic), `src/lib/form-access.ts` (ควบคุมสิทธิ์เข้าฟอร์ม), `src/app/api/admin/forms/route.ts` (จัดการฟอร์มฝั่ง admin), `src/app/api/events/[id]/form/route.ts` (ส่งคำตอบฝั่งนักศึกษา)
* **หน้าที่หลัก:** สร้างและประมวลผลฟอร์มหลายชุดต่อหนึ่งกิจกรรม หน้าตาแบบ Google Forms รองรับประเมินทั้งก่อนและหลังกิจกรรม
* **logic ภายใน:**
  * **ประเภทฟอร์ม 4 แบบ:** `K_pre` (ทดสอบก่อน), `K_post` (ทดสอบหลัง), `A` (ทัศนคติ), `S` (ทักษะ — กรอกโดยผู้ประเมิน)
  * **ประเภทคำถาม:** text, rating (ดาว), choice (เลือกเดียว), multiple (เลือกหลายตัว)
  * **section และ branching:** โครงสร้างคำถามแบบ v2 `{version: 2, sections: []}` รองรับการกระโดดข้าม section ตามคำตอบ (`__next__`, `__submit__` หรือ id ของ section) และซ่อน/แสดงคำถามแบบมีเงื่อนไข (`visibleIf`) พร้อมตัวกัน loop วนไม่จบ
  * **ให้คะแนนแบบ quiz:** `computeScore()` คิดคะแนนเฉพาะข้อที่ตั้ง `graded` และเฉพาะ section ที่นักศึกษาเดินผ่านจริง (เคารพเส้นทาง branching)
  * **[NEW] ปิดและมอบคะแนนอัตโนมัติตามเวลา:** สถานะฟอร์มคิดจาก `opensAt`/`closesAt` (open, upcoming, closed, awarded) ร่วมกับ switch `isActive` ที่ override ด้วยมือได้ พอ `isAwarded` เป็น true ฟอร์มจะถูกล็อกถาวร นักศึกษายังดูคะแนนได้แต่ส่งซ้ำไม่ได้
  * **ควบคุมสิทธิ์:** ฟอร์ม `S` จำกัดด้วย `assignedRoles`/`assignedUserIds`; ฟอร์ม `K_post`/`A`/`S` ต้องมีสถานะ `attended` ก่อนถึงจะเข้าได้
  * **export:** export คำตอบและคะแนนเป็น XLSX

### 3.6 ระบบ QR แบบลงนามและการเช็คอิน (Secure QR & Check-in)

* **ไฟล์หลัก:** `src/lib/qr-token.ts` (สร้าง/ตรวจ token), `src/modules/users/users.service.ts` (หานักศึกษาจาก token), `src/modules/events/scanner.service.ts` (logic สแกนและบังคับโควต้า)
* **logic ภายใน:**
  * **[SECURITY] QR token แบบ HMAC สไตล์ TOTP:** รูปแบบ `{userId}.{exp}.{signature}` โดย signature คือ HMAC-SHA256 ของ payload ด้วย `AUTH_SECRET` หมุน window ทุก 5 นาที (กระจาย offset รายคนกันรีเฟรชพร้อมกันถล่ม server) มี grace 30 วินาที และเช็คแบบ timing-safe กัน side-channel; มี fallback เป็น UUID แบบ static สำหรับเช็คอินด้วยมือ
  * **เช็คอินสองขั้น (Scan → Confirm):** ขั้น Scan โชว์ข้อมูลแจ้งเตือนสุขภาพให้เจ้าหน้าที่ดูก่อน แล้วค่อย Confirm บันทึกเวลาเช็คอินจริง อัปเดตแบบ atomic เฉพาะตอนสถานะยังเป็น `registered`
  * **บังคับโควต้าแบบ atomic:** ทั้งลงทะเบียนล่วงหน้าและเช็คอิน Walk-in ใช้ row lock (`FOR UPDATE`) กัน race condition (TOCTOU) — Walk-in เช็คทั้งความจุรวม (`quota + quotaWalkIn`) และเพดานย่อยของ Walk-in พร้อมกัน

### 3.7 ระบบ audit log กันแก้ (Tamper-Evident Audit Trail)

* **ไฟล์หลัก:** `src/modules/audit/audit.service.ts`
* **logic ภายใน:**
  * แต่ละแถวร้อยกันเป็น hash chain: เก็บ `prevHash` (hash ของแถวก่อนหน้า) และ `rowHash` (hash ของตัวเอง) โดยลำดับฟิลด์ตายตัว `[id, timestamp, actorId, targetId, action, ipAddress, prevHash]`
  * ใช้ advisory lock ของ PostgreSQL (`pg_advisory_xact_lock`) จัดลำดับการเขียนกัน chain ชนกัน
  * `verifyChainIntegrity()` ไล่คำนวณ hash ใหม่ทั้งสายเพื่อหาจุดแรกที่ถูกแก้
  * **[NEW] ขยายขอบเขตการ log:** ครอบคลุมการแก้/เปลี่ยน role/ลบ user, การแก้ฟอร์ม และ admin login พร้อม index ที่ `timestamp` เพื่อทำ pagination ฝั่ง server 30 รายการ/หน้า

### 3.8 ระบบ leaderboard บ้านและรายบุคคล (Leaderboard & Individual Standings)

* **ไฟล์หลัก:** `src/modules/houses/houses.service.ts`, `src/app/api/houses/individual/route.ts`, `src/app/api/houses/individual/me/route.ts`, `src/app/dashboard/houses/page.tsx`
* **logic ภายใน:**
  * จัดอันดับบ้านตาม `points DESC` และอันดับรายบุคคลตาม `points DESC, id ASC` (ตัดเสมอด้วย id ให้ผลแน่นอน) เฉพาะคนที่กรอกโปรไฟล์ครบ
  * **[NEW] หาอันดับตัวเอง:** endpoint `/api/houses/individual/me` คืน `{points, rank, total}` ของ user ปัจจุบันทันทีเมื่อ session พร้อม กัน delay ตอน render รอบแรก
  * คนที่คะแนน ≤ 0 จะคืน `rank: null` แสดงเป็น "ยังไม่ถูกจัดอันดับ" (Unranked)

### 3.9 ระบบโปสเตอร์หลายรูปและการแสดงกิจกรรม (Multi-Poster & Event Presentation)

* **ไฟล์หลัก:** `src/app/dashboard/DashboardClient.tsx` (component `PosterCarousel`), `src/app/admin/events/page.tsx` (เพิ่ม/ลบ/เรียงโปสเตอร์)
* **logic ภายใน:**
  * หนึ่งกิจกรรมมีโปสเตอร์หลายรูปผ่าน `imageUrls` (รูปแรกเป็นปก) และยัง backward-compatible กับ `imageUrl` รูปเดียวแบบเดิม
  * **carousel ปัดได้ (swipeable):** ลากซ้าย/ขวาเปลี่ยนรูป พร้อมปุ่มลูกศรและจุดบอกตำแหน่งเมื่อมีมากกว่า 1 รูป
  * **[NEW] ซูมเต็มจอ:** รองรับ pinch สองนิ้ว, double-tap สลับ 1×↔2.5× และ wheel บน desktop (ซูม 1×–4×) พร้อม pan แบบมีขอบเขตและ reset ซูมเมื่อเปลี่ยนรูป

---

## 4. แผนและผลการทดสอบระบบ (System Testing Plan & Results)

ผลการตรวจสอบการทำงานของระบบสรุปได้ดังนี้:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        สรุปขีดจำกัดด้านความปลอดภัย                       │
├───────────────────────────────────┬────────────────────────────────────┤
│           ข้อกำหนดระบบ            │           วิธีตรวจสอบ              │
│ • ขนาดรูปโปรไฟล์สูงสุด              │ 5 MB (เช็คทั้ง client & server)      │
│ • ขนาดโปสเตอร์กิจกรรมสูงสุด          │ 5 MB (เช็คทั้ง client & server)      │
│ • ความยาวเบอร์โทร                  │ 10 หลัก (ตัดความยาวอัตโนมัติ รับเฉพาะเลข)│
│ • ความยาวรหัสนักศึกษา               │ 9 หลัก (ตัดความยาวอัตโนมัติ รับเฉพาะเลข) │
│ • ข้อมูลสุขภาพนักศึกษา              │ เข้ารหัสระดับฟิลด์ + ลง audit trail     │
│ • อายุ session login (JWT)          │ 7 วัน (refresh DB ทุก 2 นาที)          │
│ • อายุ QR token                    │ 5 นาที + grace 30 วินาที (ลงนาม HMAC) │
│ • ความสมบูรณ์ของ audit chain        │ SHA256 hash chain (ตรวจจับการแก้ได้)  │
│ • โควต้ากิจกรรม                     │ รวม + ไทย/อินเตอร์ + Walk-in (atomic)  │
└───────────────────────────────────┴───────────────────────────────────────┘
```

* **ทดสอบความเสถียรของ memory บน server:** จากการ build แบบ production และรัน 11 workers ประมวลผลหน้าเพจ ระบบทำงานได้เร็วและไม่มี memory leak
* **ความปลอดภัยของระบบเก็บไฟล์:** กันดิสก์เต็มได้ เพราะระบบยกเลิกการเขียนตั้งแต่ระดับ buffer เมื่อเจอไฟล์เกิน 5MB ช่วยประหยัด storage และกัน DoS บนดิสก์

---

เอกสาร SRS ฉบับนี้เรียบเรียงพฤติกรรมของไฟล์ในระบบไว้ครบถ้วน พร้อมส่งให้ฝ่าย IT ของสถาบันตรวจสอบต่อไป
