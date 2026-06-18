# 💻 ActiveCAMT — โครงสร้างข้อมูลและฐานข้อมูล (Database Schema & Security)

**เวอร์ชัน:** 1.0 | **อัปเดตล่าสุด:** 2026-06-18  
**สถานะ:** เสร็จสมบูรณ์ (เวอร์ชัน 1.2)  
**ลิงก์ดัชนี:** [กลับหน้าหลัก](../index.md)

---

## 1. ภาพรวมฐานข้อมูล (Database Overview)
ActiveCAMT ใช้ **PostgreSQL** เป็นระบบจัดการฐานข้อมูลหลัก และนิยามโครงสร้างตารางผ่าน **Drizzle ORM** ในไฟล์ `src/db/schema.ts` ข้อมูลแบ่งออกเป็น 5 กลุ่มหลัก:
1. **ข้อมูลผู้ใช้และความปลอดภัย (Users & Auth)**
2. **ข้อมูลกิจกรรมและการเช็คอิน (Events & Attendance)**
3. **ระบบคะแนนบ้าน (Houses & Scoring)**
4. **ระบบฟอร์ม KAS (Forms & Submissions)**
5. **ระบบร้านค้าของที่ระลึก (Shop & Merch)**

---

## 2. รายละเอียดตารางและฟิลด์ (Table Schema Details)

### 2.1 กลุ่มตารางผู้ใช้และยืนยันตัวตน (Users & Authentication)

#### 📋 ตาราง `houses`
เก็บข้อมูลกลุ่มบ้านหลักทั้ง 4 บ้าน (บ้านมอม, บ้านโต, บ้านลวง, บ้านมกร)
* `id` (text, primaryKey): รหัสบ้าน ภาษาอังกฤษตัวเล็ก (เช่น `'red'`, `'blue'`, `'green'`, `'yellow'`)
* `name` (text, notNull): ชื่อบ้าน (เช่น บ้านมอม, บ้านโต, บ้านลวง, บ้านมกร)
* `color` (text): รหัสสีฐานสิบหก (Hex Color) สำหรับแสดงผลบน Leaderboard (ค่าเริ่มต้น `#6366f1`)
* `points` (integer, default 0): คะแนนสะสมของบ้านในปัจจุบัน

#### 📋 ตาราง `users`
เก็บข้อมูลส่วนตัว บทบาท และข้อมูลสำคัญทางด้านการแพทย์ของนักศึกษา
* `id` (text, primaryKey): รหัสผู้ใช้ที่สร้างโดย Google Provider หรือ OAuth
* `prefix` (text): คำนำหน้านาม (เช่น นาย, นางสาว, Mr., Ms.)
* `name` (text, notNull): ชื่อ-นามสกุลเต็ม
* `email` (text, unique, notNull): อีเมลนักศึกษา (จำกัดเฉพาะกลุ่ม `@cmu.ac.th`)
* `emailVerified` (timestamptz)
* `image` (text): ลิงก์รูปโปรไฟล์เดิมจากบัญชี Google
* `role` (text, default `'student'`): บทบาทหลักบทบาทเดียว
* `roles` (jsonb): บันทึกบทบาทการทำงานหลายระดับในรูปแบบ Array (เช่น `["student", "smo"]`)
* `houseId` (text, references `houses.id`): รหัสบ้านที่สังกัด
* `points` (integer, default 0): คะแนนสะสมรายบุคคล
* `qrToken` (text, unique): โทเค็นคิวอาร์สำหรับการเช็คอิน
* `studentId` (text, unique): รหัสนักศึกษา 9 หลัก (แก้ไม่ได้ภายหลังการ Onboarding)
* `nickname` (text): ชื่อเล่น
* `major` (text): สาขาวิชา (ANI, DG, DII, MMIT, SE)
* `imageTransform` (jsonb): พิกัดการครอบตัดรูปโปรไฟล์ `{scale, x, y}`
* `religion` (text): ศาสนา
* `phone` (text, unique): เบอร์โทรศัพท์มือถือ 10 หลัก
* `contactChannels` (text): ช่องทางการติดต่อทางเลือก
* **ฟิลด์ข้อมูลอ่อนไหว (Sensitive Data - เข้ารหัสข้อมูลระดับฟิลด์):**
  * `chronicDiseases` (text): โรคประจำตัว
  * `medicalHistory` (text): ประวัติการรักษาพยาบาล
  * `drugAllergies` (text): ยาที่แพ้
  * `foodAllergies` (text): อาหารที่แพ้
  * `dietaryRestrictions` (text): ข้อจำกัดทางอาหาร (เช่น มังสวิรัติ, ฮาลาล)
  * `faintingHistory` (boolean): ประวัติการเป็นลมบ่อยครั้ง
  * `emergencyMedication` (text): ยาที่พกติดตัวสำหรับกรณีฉุกเฉิน
  * `emergencyContacts` (jsonb): รายชื่อติดต่อฉุกเฉิน บันทึกเป็นอาเรย์ของวัตถุ `[{name, relationship, phone}]`
* `pdpaConsent` (boolean, default false): สถานะยอมรับเงื่อนไขการคุ้มครองข้อมูลส่วนบุคคล
* `profileCompleted` (boolean, default false): ยืนยันข้อมูล Onboarding เสร็จสิ้น
* `createdAt` / `updatedAt` (timestamptz)
* *ดัชนี (Indexes):* `idx_users_profile_completed` บนฟิลด์ `profileCompleted`, `idx_users_house_id` บนฟิลด์ `houseId`

#### 📋 ตารางสำหรับ NextAuth (Auth Metadata)
* **`authenticator`**: ตารางเก็บคีย์ลงทะเบียนยืนยันตัวตน (WebAuthn / Passkeys)
* **`account`**: ตารางผูกบัญชี Google OAuth เข้ากับบัญชีเว็บ
* **`session`**: จัดการเซสชันล็อกอินของเบราวเซอร์ (หมดอายุ 7 วัน)
* **`verificationToken`**: โทเค็นชั่วคราวสำหรับยืนยันความปลอดภัย

---

### 2.2 กลุ่มตารางกิจกรรมและการเข้าร่วม (Events & Attendance)

#### 📋 ตาราง `events`
เก็บข้อมูลกิจกรรมและรายละเอียดการจำกัดโควต้าการเข้าร่วม
* `id` (uuid, defaultRandom, primaryKey): รหัสกิจกรรม
* `title` (text, notNull): ชื่อกิจกรรม
* `description` (text): คำอธิบายกิจกรรม (รองรับมาร์กอัปแบบหนา สี ลิงก์)
* `startTime` / `endTime` (timestamptz, notNull): เวลาเริ่มและจบกิจกรรม
* `registrationOpenTime` / `registrationCloseTime` (timestamptz): ช่วงเวลาเปิด-ปิดลงทะเบียน
* `quota` (integer): ความจุโควต้ารวมสูงสุด
* `location` (text): สถานที่จัดกิจกรรม
* `pointsAwarded` (integer, default 0): คะแนนรางวัลบ้านที่จะได้รับเมื่อชนะการเข้าร่วมกิจกรรมนี้
* `imageUrl` (text): ลิงก์รูปหน้าปกหลัก (สำหรับโปรเจกต์เดิม)
* `imageUrls` (jsonb): อาเรย์ของลิงก์ภาพโปสเตอร์ (รองรับการปัด Carousel และซูมเต็มจอ)
* `walkInsEnabled` (boolean, default false): สถานะยอมรับผู้เข้าร่วมแบบไม่ได้ลงทะเบียนล่วงหน้า (Walk-in)
* `quotaWalkIn` (integer): โควต้าจำกัดสำหรับ Walk-in
* `targetThai` / `targetInternational` (boolean, default true): การเปิดรับกลุ่มหลักสูตรไทยและต่างประเทศ
* `quotaThai` / `quotaInternational` (integer): โควต้าจำกัดเฉพาะหลักสูตรไทยและต่างประเทศ
* `allowedRoles` (jsonb): สิทธิ์การเข้าชม/ลงทะเบียนอิงตามบทบาทผู้ใช้
* `allowedMajors` (jsonb): สิทธิ์การเข้าชม/ลงทะเบียนอิงตามสาขาวิชา (เช่น เฉพาะนักศึกษา SE)
* `winnerAwardedAt` (timestamptz): บันทึกเวลาที่ระบบให้คะแนนโบนัสบ้านผู้เข้าร่วมสูงสุด (ป้องกันสิทธิ์ประมวลผลซ้ำซ้อน)

#### 📋 ตาราง `attendance`
บันทึกการลงทะเบียนและประวัติการสแกนเช็คอินกิจกรรมของนักศึกษา
* `id` (uuid, primaryKey)
* `eventId` (uuid, references `events.id` ON DELETE CASCADE, notNull)
* `studentId` (text, references `users.id` ON DELETE CASCADE, notNull)
* `checkInTime` (timestamptz): บันทึกเวลาที่สแกนเช็คอินสำเร็จ (เป็น NULL จนกว่าจะสแกนจริง)
* `method` (text): วิธีการเข้าร่วม (`'qr'`, `'manual'`, `'walk-in'`, `'pre-registered'`)
* `status` (text, default `'registered'`): สถานะเช็คอิน (`'registered'` = ลงทะเบียนแล้ว, `'attended'` = เข้าร่วมกิจกรรมแล้ว)
* `scannedBy` (text, references `users.id` ON DELETE SET NULL): แอดมินผู้สแกนเช็คอิน
* `medsCheckOption` (text): ข้อมูลการประเมินการแพทย์เบื้องต้นหน้างาน (ดูได้เฉพาะระดับ Admin)
* *ดัชนี (Indexes):* `idx_attendance_event_student` (uniqueIndex ป้องกันข้อมูลซ้ำซ้อน), `idx_attendance_student` บนฟิลด์ `studentId`, `idx_attendance_checkin_time` บนฟิลด์ `checkInTime`

---

### 2.3 กลุ่มตารางระบบคะแนนบ้าน (Houses & Scoring)

#### 📋 ตาราง `score_history`
เก็บบันทึกประวัติการเปลี่ยนแปลงคะแนนของแต่ละบ้าน ย้อนหลังเพื่อนำมาแสดงฟีดกิจกรรมและลีดเดอร์บอร์ดแบบ Real-time
* `id` (uuid, primaryKey)
* `houseId` (text, references `houses.id` ON DELETE CASCADE): รหัสบ้านที่ได้รับ/สูญเสียคะแนน (สามารถเป็น NULL ได้ในกรณีที่กิจกรรมนั้นไม่มีผู้เข้าร่วมเลย)
* `eventId` (uuid, references `events.id` ON DELETE CASCADE): รหัสกิจกรรมที่เป็นที่มาของคะแนน
* `delta` (integer, notNull): จำนวนคะแนนที่เพิ่มขึ้น (บวก) หรือถูกหัก (ลบ)
* `reason` (text, notNull): เหตุผลประกอบการให้คะแนน (ใช้ประมวลผลแปลแสดงผล 4 ภาษา)
* `timestamp` (timestamptz, defaultNow)
* *ดัชนี (Indexes):* `idx_score_history_event` บนฟิลด์ `eventId`, `idx_score_history_timestamp` บนฟิลด์ `timestamp` (ปรับปรุงประสิทธิภาพการทำงาน `ORDER BY timestamp DESC` ในหน้ากิจกรรมล่าสุด)

---

### 2.4 กลุ่มตารางระบบความปลอดภัย (Security & Audit)

#### 📋 ตาราง `audit_logs`
จัดเก็บประวัติการปรับปรุงระดับแอดมินแบบ **Immutable (ห้าม UPDATE/DELETE ย้อนหลัง)** ป้องกันการเจาะระบบเพื่อทำลายหลักฐาน
* `id` (uuid, primaryKey)
* `timestamp` (timestamptz, defaultNow)
* `actorId` (text): ไอดีแอดมินผู้กระทำ (ไม่มี FK ชี้ไปยัง `users.id` เพื่อรักษาสาย Chain แม้ผู้ใช้ถูกลบ)
* `targetId` (text): ไอดีผู้ใช้ที่เป็นเป้าหมายการกระทำ
* `action` (text, notNull): รายละเอียดของเหตุการณ์ความปลอดภัย (เช่น `view_medical_detail`, `change_role`)
* `ipAddress` (text): เลขไอพีแอดเดรสของผู้ใช้งาน
* `prevHash` (text, notNull, default `''`): ค่า Hash SHA-256 ของล็อกตารางแถวก่อนหน้า
* `rowHash` (text, notNull, default `''`): ค่า Hash SHA-256 ของตารางแถวตัวเอง
* *ดัชนี (Indexes):* `idx_audit_logs_timestamp` ปรับปรุงประสิทธิภาพ Pagination หน้าตรวจสอบย้อนหลัง

---

### 2.5 กลุ่มตารางระบบฟอร์ม KAS (Forms & Evaluation)

#### 📋 ตาราง `forms`
เก็บโครงสร้างคำถามและเงื่อนไขแบบประเมินของกิจกรรม
* `id` (uuid, primaryKey)
* `eventId` (uuid, references `events.id` ON DELETE CASCADE, notNull)
* `formType` (text, default `'K_post'`, notNull): ประเภทของฟอร์ม (`'K_pre'`, `'K_post'`, `'A'`, `'S'`)
* `sortOrder` (integer, default 0, notNull): ลำดับการแสดงผลของฟอร์ม
* `title` (text, notNull): หัวข้อฟอร์มประเมิน
* `description` (text): คำชี้แจงฟอร์ม
* `questions` (jsonb, notNull): โครงสร้างฟอร์มแบบ Section & Branching (รุ่น v2)
* `pointsAwarded` (integer, default 0): คะแนนโบนัสสะสมที่จะมอบให้กับบ้านที่ส่งแบบประเมินมากที่สุด
* `isActive` (boolean, default true): ตัวสลับเปิดใช้งานด้วยมือ
* `isAwarded` (boolean, default false): สถานะมอบคะแนนโบนัสเสร็จสิ้น (ล็อกไม่ให้ส่งคำตอบเพิ่ม)
* `opensAt` / `closesAt` (timestamptz): ช่วงเวลาเปิด-ปิดรับฟอร์มอัตโนมัติ
* `assignedRoles` / `assignedUserIds` (jsonb): สิทธิ์ผู้ใช้/บทบาทเฉพาะในการประเมิน (จำกัดฟอร์มประเภท S)

#### 📋 ตาราง `form_submissions`
เก็บบันทึกคำตอบที่นักศึกษาส่งเข้ามา
* `id` (uuid, primaryKey)
* `formId` (uuid, references `forms.id` ON DELETE CASCADE, notNull)
* `studentId` (text, references `users.id` ON DELETE CASCADE, notNull)
* `answers` (jsonb, notNull): คำตอบแต่ละข้อ บันทึกเป็น JSON วัตถุ `{questionId: Answer}`
* `submittedAt` (timestamptz, defaultNow)
* *ดัชนี (Indexes):* `idx_form_submissions_form_student` (uniqueIndex จำกัดสิทธิ์ให้ส่งคำตอบได้เพียงครั้งเดียวต่อฟอร์ม)

---

### 2.6 กลุ่มตารางระบบร้านค้าและการประชาสัมพันธ์ (Shop & Banner)

#### 📋 ตาราง `announcements`
เก็บข้อความประกาศแบนเนอร์เด่นในหน้า Dashboard (บอร์ดแสดงผลรวม)
* `id` (uuid, primaryKey)
* `body` (text, notNull): ข้อความประกาศ (รองรับตัวหนา ลิงก์ และสลับสีตัวอักษร)
* `enabled` (boolean, default true): สวิตช์เปิด-ปิดการแสดงผลแถบประกาศ
* `updatedBy` (text): แอดมินผู้อัปเดตล่าสุด
* `updatedAt` (timestamptz, defaultNow)

#### 📋 ตาราง `shop_settings`
เก็บการตั้งค่าช่องทางชำระเงินของร้านค้า Merch
* `id` (uuid, primaryKey)
* `enabled` (boolean, default true): สวิตช์เปิด-ปิดระบบร้านค้าทั้งระบบ
* `paymentInfo` (text, notNull): ข้อมูลรายละเอียดบัญชีธนาคาร/พร้อมเพย์ (รองรับ rich text)
* `qrImageUrl` (text): รูปภาพคิวอาร์พร้อมเพย์ของร้านค้า
* `updatedBy` / `updatedAt` (timestamptz)

#### 📋 ตาราง `shop_products`
เก็บรายการสินค้าคงคลังของระบบร้านค้า
* `id` (uuid, primaryKey)
* `name` (text, notNull): ชื่อสินค้า
* `description` (text, default `''`, notNull): รายละเอียดสินค้า
* `price` (integer, default 0, notNull): ราคาสินค้า (หน่วยบาท)
* `imageUrl` (text): หน้าปกสินค้าหลัก
* `imageUrls` (jsonb): คลังรูปภาพประกอบสินค้าเพิ่มเติม
* `maxPerOrder` (integer): จำนวนสินค้าสูงสุดต่อหนึ่งออเดอร์
* `opensAt` / `closesAt` (timestamptz): ช่วงเวลาจำกัดการขายสินค้า
* `isActive` (boolean, default true): ตัวสลับสถานะสินค้าพร้อมขาย
* `sortOrder` (integer, default 0, notNull): ลำดับจัดเรียงการวางขายสินค้า

#### 📋 ตาราง `shop_variants`
เก็บตัวเลือกลักษณะแยกของสินค้า (เช่น ขนาดเสื้อ, สีเสื้อ)
* `id` (uuid, primaryKey)
* `productId` (uuid, references `shop_products.id` ON DELETE CASCADE, notNull)
* `label` (text, notNull): ขนาดหรือตัวเลือก (เช่น `'S'`, `'M'`, `'L'`, `'Standard'`)
* `stock` (integer): จำนวนชิ้นคงเหลือในระบบ (NULL = ไม่จำกัดจำนวนสต็อก)
* `allowCustom` (boolean, default false): อนุญาตให้นักศึกษาพิมพ์ระบุคำขอเพิ่มเติมได้ด้วยมือ
* `sortOrder` (integer, default 0, notNull)
* *ดัชนี (Indexes):* `idx_shop_variants_product` บนฟิลด์ `productId`

#### 📋 ตาราง `shop_orders`
บันทึกออเดอร์และข้อมูลสลิปยืนยันการโอนเงินของนักศึกษา
* `id` (uuid, primaryKey)
* `buyerId` (text, references `users.id` ON DELETE CASCADE, notNull): ผู้ทำรายการสั่งซื้อ
* `status` (text, default `'pending'`, notNull): สถานะรายการ (`'pending'`, `'approved'`, `'rejected'`)
* `slipPath` (text): พาร์ทอ้างอิงภาพสลิปที่เก็บไว้ใน Private Storage (ไม่ใช่ URL สาธารณะ)
* `totalAmount` (integer, default 0, notNull): ยอดรวมสุทธิของออเดอร์
* `note` (text): หมายเหตุเพิ่มเติมจากผู้ซื้อ
* `reviewedBy` (text): เจ้าหน้าที่ผู้ตรวจสอบออเดอร์
* `reviewedAt` (timestamptz): เวลาที่กดยืนยันออเดอร์
* `rejectionReason` (text): สาเหตุการปฎิเสธออเดอร์ (กรณีสลิปมีปัญหา หรือสินค้าหมดจริง)
* *ดัชนี (Indexes):* `idx_shop_orders_buyer` บนฟิลด์ `buyerId`, `idx_shop_orders_status` บนฟิลด์ `status`

#### 📋 ตาราง `shop_order_items`
บันทึกรายการสินค้าแต่ละรายการภายในออเดอร์ (Snapshot สินค้า)
* `id` (uuid, primaryKey)
* `orderId` (uuid, references `shop_orders.id` ON DELETE CASCADE, notNull)
* `productId` / `variantId` (uuid, references set null): เชื่อมสินค้าและตัวเลือก (เป็น NULL เมื่อตัวสินค้าหลักโดนลบ)
* `productName` (text, notNull): ชื่อสินค้า ณ เวลาสั่งซื้อ (Snapshot)
* `variantLabel` (text, notNull): ตัวเลือกที่สั่งซื้อ ณ เวลาสั่งซื้อ (Snapshot)
* `unitPrice` (integer, notNull): ราคาต่อหน่วย ณ เวลาสั่งซื้อ (Snapshot)
* `quantity` (integer, notNull): จำนวนชิ้นที่สั่งซื้อ
* *ดัชนี (Indexes):* `idx_shop_order_items_order` บนฟิลด์ `orderId`, `idx_shop_order_items_variant` บนฟิลด์ `variantId`

---

## Related Documents
- [01-system-design.md](./01-system-design.md) — สถาปัตยกรรมและรายละเอียด Subsystem
- [02-class-diagram.md](./02-class-diagram.md) — ลำดับการไหลของระบบ (Mermaid Charts)
