# 💻 ActiveCAMT — แผนผังการไหลของข้อมูลและโมดูล (Process Flows & Architecture Diagrams)

**เวอร์ชัน:** 1.0 | **อัปเดตล่าสุด:** 2026-06-18  
**สถานะ:** เสร็จสมบูรณ์ (เวอร์ชัน 1.2)  
**ลิงก์ดัชนี:** [กลับหน้าหลัก](../index.md)

---

## 1. แผนผังการทำงานหลัก (System Process Flows)

### 1.1 ขั้นตอนการยืนยันตัวตนด้วย Secure QR (Secure QR Verification Flow)
แผนผังด้านล่างแสดงโครงสร้างการตรวจสอบคิวอาร์โค้ดของนักศึกษาโดยแอดมิน เพื่อความมั่นใจว่าคิวอาร์โค้ดนั้นปลอดภัยและเพิ่งสร้างขึ้นจริงภายใน 5 นาที:

```mermaid
sequenceDiagram
    autonumber
    actor Student as นักศึกษา
    actor Scanner as แอดมิน (ผู้สแกน)
    participant Server as เซิร์ฟเวอร์ (Next.js API)
    participant DB as ฐานข้อมูล (PostgreSQL)

    Student->>Server: ขอรหัส QR (Request QR Token)
    Server->>Server: ดึง userId + เวลาปัจจุบัน + คำนวณ offset รายบุคคล
    Server->>Server: สร้างลายเซ็น HMAC-SHA256 ด้วย AUTH_SECRET
    Server-->>Student: คืนค่า token = "userId.exp.signature"
    Student->>Student: เรนเดอร์เป็นภาพ QR Code บนเว็บ

    Scanner->>Student: สแกนภาพ QR Code ด้วยกล้องหน้าเว็บ
    Scanner->>Server: ส่ง token ไปที่ API /api/admin/scan
    Server->>Server: แยก token เพื่อตรวจอายุโทเค็น (grace period 30 วินาที)
    Server->>Server: ตรวจสอบลายเซ็น HMAC แบบ Timing-Safe (ป้องกัน Side-Channel)
    
    alt โทเค็นไม่ถูกต้อง หรือหมดอายุ
        Server-->>Scanner: แจ้งเตือนข้อผิดพลาด (Invalid/Expired QR)
    else โทเค็นถูกต้อง
        Server->>DB: ค้นหาข้อมูลสุขภาพผู้ใช้ ( chronicDiseases / medicalHistory )
        DB-->>Server: ส่งคืนข้อมูลสุขภาพนักศึกษา
        Server-->>Scanner: แสดงข้อมูลแจ้งเตือนด้านการแพทย์ (Medical Signal Alert)
        
        Scanner->>Server: กดยืนยันการลงชื่อเข้าร่วมกิจกรรม (Confirm Attendance)
        Server->>DB: บันทึกข้อมูลเช็คอินแบบใช้ Row Lock (FOR UPDATE กัน Quota เกิน)
        DB-->>Server: บันทึกสำเร็จ
        Server->>Server: ส่งสัญญาณอัปเดตไปยังระบบ Real-time (SSE / IPC)
        Server-->>Scanner: แสดงหน้าจอการสแกนสำเร็จ
    end
```

---

### 1.2 การเขียนและเรียงห่วงโซ่ประวัติความปลอดภัย (Audit Log Hash Chaining Flow)
เพื่อป้องกันการลบหรือแก้ไขข้อมูลความปลอดภัยย้อนหลัง ล็อกจะถูกบันทึกร้อยเรียงต่อกันเป็น Hash Chain ดังนี้:

```mermaid
flowchart TD
    Start["เกิดเหตุการณ์ที่ต้องบันทึก (Action Event)"] --> AcquireLock["ขอ advisory lock (pg_advisory_xact_lock)"]
    AcquireLock --> GetLastRow["ดึงแถวล่าสุด (Order by timestamp DESC Limit 1)"]
    
    subgraph "คำนวณรหัส Chain"
        GetLastRow --> ExtractPrevHash["ดึงค่า rowHash ของแถวก่อนหน้ามาเป็น prevHash"]
        ExtractPrevHash --> ConcatFields["รวมฟิลด์: [id, timestamp, actorId, targetId, action, ipAddress, prevHash]"]
        ConcatFields --> CalculateHash["เข้ารหัส SHA-256 ได้ค่า row_hash ใหม่"]
    end
    
    CalculateHash --> InsertDB["บันทึกลงฐานข้อมูล (ห้าม UPDATE/DELETE)"]
    InsertDB --> ReleaseLock["คืนพื้นที่และปลดล็อก Advisory Lock"]
    ReleaseLock --> End["เสร็จสิ้นการบันทึก"]
```

---

### 1.3 การสื่อสารแบบ Real-time ข้ามโปรเซส (SSE Cross-Process IPC)
ภาพแสดงการทำงานเมื่อ Next.js ทำงานแบบ Multi-worker หรือคลัสเตอร์ โดยสื่อสารระหว่างกันผ่านดิสก์แบบ Event Broker:

```mermaid
graph LR
    subgraph "Next.js Workers"
        W1["Worker 1 (ทำหน้าที่บันทึกข้อมูล/สแกน)"]
        W2["Worker 2 (ทำหน้าที่ถือท่อ SSE เปิดให้ Client)"]
    end

    subgraph "Shared Disk Space (/scratch)"
        EventFile["ไฟล์อีเวนต์ชั่วคราว (.json)"]
    end

    subgraph "Client App"
        Browser["หน้าเว็บบราวเซอร์ของนักศึกษา/แอดมิน"]
    end

    W1 -->|1. เขียนอีเวนต์| EventFile
    EventFile -->|2. ตรวจพบไฟล์ใหม่ด้วย fs.watch| W2
    W2 -->|3. ลบไฟล์ทิ้งทันที| EventFile
    W2 -->|4. ดันข้อมูลผ่าน SSE Stream| Browser
```

---

## 2. ความสัมพันธ์ระดับสถาปัตยกรรม (Module Interactions)
* **`auth.ts` -> `proxy.ts`**: Middleware กรองคำร้องขอและสิทธิ์ตั้งแต่ชั้นนอกสุดของระบบ โดยบทบาท SMO จะได้รับการคัดกรองให้เข้าชมได้เฉพาะหน้า `/admin/scanner` เท่านั้น
* **`scanner.service.ts` -> `audit.service.ts`**: เมื่อการยืนยันตัวตนสำเร็จ ระบบจะสั่งบันทึกการทำงานของแอดมินลงในบันทึกที่แก้ไขไม่ได้โดยอัตโนมัติ
* **`scanner.service.ts` -> `realtime-emitter.ts`**: ส่งสัญญาณข้อมูลกิจกรรมและการสแกนไปยังนักศึกษาและหน้าจอสรุปผลของแอดมินแบบทันที

---

## Related Documents
- [01-system-design.md](./01-system-design.md) — โครงสร้างระบบย่อยและการควบคุมสิทธิ์
- [03-data-schema.md](./03-data-schema.md) — โครงสร้างข้อมูลสคีมาฐานข้อมูล
