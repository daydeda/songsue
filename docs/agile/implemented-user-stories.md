# ActiveCAMT — สรุป User Stories ที่พัฒนาแล้ว (Implemented Features)

**เวอร์ชัน:** 1.0 | **อัปเดตล่าสุด:** 2026-06-18  
**วิธีจัดทำ:** Reverse Engineering จาก Source Code  
**ลิงก์ดัชนี:** [กลับหน้าหลัก](../index.md)

> เอกสารนี้รวบรวม User Stories ทั้งหมดที่พัฒนาและ Deploy ไปแล้ว จัดกลุ่มตาม Feature Area โดยอ้างอิงจาก Source Code จริง (`src/`) และประวัติ Git (PR #1–51)

---

## สารบัญ

1. [Authentication & Onboarding](#1-authentication--onboarding)
2. [QR Check-In & Scanning System](#2-qr-check-in--scanning-system)
3. [Event Management](#3-event-management)
4. [Evaluation Forms (KAS)](#4-evaluation-forms-kas)
5. [Leaderboard & House Points](#5-leaderboard--house-points)
6. [Merch Shop](#6-merch-shop)
7. [Admin Dashboard & Tools](#7-admin-dashboard--tools)
8. [PDPA & Medical Data Handling](#8-pdpa--medical-data-handling)
9. [Audit Log & Tamper Evidence](#9-audit-log--tamper-evidence)
10. [Live Notifications (SSE)](#10-live-notifications-sse)
11. [Role-Based Access Control (RBAC)](#11-role-based-access-control-rbac)
12. [Background Tasks (Cron Jobs)](#12-background-tasks-cron-jobs)

---

## 1. Authentication & Onboarding

### IMP-AUTH-01 — Google OAuth Sign-In (CMU Domain)
| | |
|:---|:---|
| **Actor** | นักศึกษา, Staff, Admin |
| **Action** | Sign in ด้วย Google Account ลงท้าย `@cmu.ac.th` |
| **Benefit** | เข้าระบบปลอดภัยโดยไม่ต้องจัดการ password |
| **Technical** | NextAuth v5, JWT strategy (7-day max age), domain restriction |
| **Implementation** | `src/auth.ts`, `/api/auth/[...nextauth]/route.ts` |

---

### IMP-AUTH-02 — Student Profile Onboarding
| | |
|:---|:---|
| **Actor** | นักศึกษาใหม่ |
| **Action** | กรอกข้อมูลส่วนตัว, ข้อมูลทางการแพทย์ และผู้ติดต่อฉุกเฉินในการเข้าใช้งานครั้งแรก |
| **Benefit** | ระบบสามารถดูแลความปลอดภัยของนักศึกษาตลอดกิจกรรม |
| **ข้อมูลที่จัดเก็บ** | ชื่อ, ชื่อเล่น, สาขา (ANI/DG/DII/MMIT/SE), เบอร์โทร, ศาสนา, โรคประจำตัว, การแพ้ยา, ข้อจำกัดอาหาร, ประวัติหมดสติ, ยาฉุกเฉิน, ผู้ติดต่อฉุกเฉิน (jsonb array), รูปโปรไฟล์ |
| **Technical** | Image transform (crop/scale) stored as jsonb; PDPA consent required |
| **Implementation** | `/app/onboarding/page.tsx`, `/api/profile/route.ts` |

---

### IMP-AUTH-03 — Staff Onboarding Bypass
| | |
|:---|:---|
| **Actor** | Staff / อาจารย์ (pre-listed emails) |
| **Action** | ข้าม onboarding form ทั้งหมด; ได้รับบทบาท `staff` และ house โดยอัตโนมัติ |
| **Benefit** | Onboarding รวดเร็วสำหรับทีมงาน ไม่ต้องกรอกข้อมูลสุขภาพ |
| **Technical** | Hardcoded email → nickname mapping ใน `src/lib/staff-bypass.ts`; `HousesService.pickBalancedHouseId()` |
| **Implementation** | `/app/onboarding/page.tsx`, `UsersService.provisionStaffBypass()` |
| **รองรับ** | 9+ accounts (อัปเดต PR #51) |

---

### IMP-AUTH-04 — Profile Completion Gate & Redirect
| | |
|:---|:---|
| **Actor** | ระบบ (Middleware) |
| **Action** | ผู้ใช้ที่ยังไม่กรอก profile จะถูก redirect ไป `/onboarding`; ผู้ที่กรอกแล้วจะถูก redirect ออกจาก `/onboarding` |
| **Benefit** | บังคับให้ข้อมูลครบก่อนใช้งานระบบ |
| **Technical** | `profileCompleted` flag ตรวจสอบใน middleware |
| **Implementation** | `src/proxy.ts`, `/api/events/[id]/register/route.ts` |

---

### IMP-AUTH-05 — Profile Picture Upload
| | |
|:---|:---|
| **Actor** | นักศึกษา, Admin |
| **Action** | อัปโหลดและ crop รูปโปรไฟล์ |
| **Benefit** | แสดง Avatar บน leaderboard และหน้า scanner |
| **Technical** | Max 5MB; crop position stored as jsonb `{scale, x, y}`; public bucket |
| **Implementation** | `/api/upload/route.ts`, `src/lib/image-upload.ts` |

---

### IMP-AUTH-06 — Super-Admin Auto-Promotion
| | |
|:---|:---|
| **Actor** | ระบบ (Auth callback) |
| **Action** | อีเมลใน `SUPER_ADMIN_EMAILS` env var จะได้รับบทบาท `super_admin` อัตโนมัติเมื่อ sign in |
| **Benefit** | Provision super admin โดยไม่ต้องแก้ DB ด้วยมือ |
| **Technical** | Case-insensitive match; fallback to hardcoded email หาก env ไม่ถูกตั้ง |
| **Implementation** | `src/auth.ts` (lines 13–16, 127–131) |

---

### IMP-AUTH-07 — Session Auto-Refresh
| | |
|:---|:---|
| **Actor** | ระบบ (JWT callback) |
| **Action** | JWT token refresh ทุก 2 นาทีเพื่อ sync การเปลี่ยนแปลงจาก DB |
| **Benefit** | การเปลี่ยน role/house สะท้อนผลภายใน 2 นาทีโดยไม่ต้อง re-login |
| **Technical** | `DB_REFRESH_INTERVAL_MS = 2 * 60 * 1000` ใน jwt callback |
| **Implementation** | `src/auth.ts` (jwt callback) |

---

### IMP-AUTH-08 — Google Account Chooser Force
| | |
|:---|:---|
| **Actor** | ระบบ (Auth) |
| **Action** | บังคับให้ Google แสดงหน้าเลือก account ทุกครั้ง |
| **Benefit** | แก้ปัญหา session cookie หลุดเมื่อใช้หลายบัญชี |
| **Technical** | `prompt: "select_account"` ใน Google provider config |
| **Implementation** | PR #41 |

---

## 2. QR Check-In & Scanning System

### IMP-QR-01 — QR Token Generation (UUID)
| | |
|:---|:---|
| **Actor** | ระบบ (Auth callback) |
| **Action** | สร้าง unique UUID v4 `qrToken` สำหรับนักศึกษาแต่ละคนเมื่อ sign in ครั้งแรก |
| **Benefit** | QR Code ที่ stateless และปลอดภัย; รองรับ offline verification |
| **Technical** | Idempotent: ตรวจสอบว่ามีอยู่แล้วก่อนสร้าง; เก็บใน `users.qr_token` |
| **Implementation** | `src/auth.ts` (jwt callback), `/api/qr-token/route.ts` |

---

### IMP-QR-02 — Short-Lived Signed QR Token
| | |
|:---|:---|
| **Actor** | นักศึกษา (ผู้แสดง QR) |
| **Action** | ระบบสร้าง signed token อายุสั้น (5 นาที) จาก UUID สำหรับแสดงบนหน้าจอ |
| **Benefit** | ป้องกันการ screenshot แล้วนำ QR ไปสแกนแทน |
| **Technical** | HMAC-SHA256 signed; grace period 30 วินาที; timing-safe comparison |
| **Implementation** | `/api/qr-token/route.ts`, `src/lib/qr-token.ts` |

---

### IMP-QR-03 — QR Scanner Interface
| | |
|:---|:---|
| **Actor** | SMO, Club President, Major President, Registration, Organizer, Admin |
| **Action** | สแกน QR Code นักศึกษา → resolve → เช็คอินหรือให้/ตัดคะแนน |
| **Benefit** | ระบบเช็คอินแบบไร้กระดาษแบบ real-time |
| **Technical** | `html5-qrcode` library; scanner-only roles จำกัดเฉพาะหน้านี้ |
| **Rate Limit** | 300 requests/min ต่อ IP |
| **Implementation** | `/app/admin/scanner/page.tsx`, `/api/admin/scan/route.ts` |

---

### IMP-QR-04 — Two-Stage Check-In (Scan → Confirm)
| | |
|:---|:---|
| **Actor** | Admin (scanner) |
| **Action** | สแกน QR → ดูสัญญาณสุขภาพ → ยืนยันเช็คอิน |
| **Benefit** | ป้องกัน mis-scan; แจ้งเตือนสุขภาพที่ประตูงาน |
| **Technical** | `action: 'scan'` → medical signal; `action: 'confirm'` → บันทึกเช็คอิน |
| **PDPA** | Non-admin เห็นเพียง boolean `hasMedicalCondition`; Admin เห็นรายละเอียดเต็ม |
| **Implementation** | `/api/admin/scan/route.ts` (ScannerService.processScan) |

---

### IMP-QR-05 — Walk-In Registration at Check-In
| | |
|:---|:---|
| **Actor** | Admin (scanner), นักศึกษาที่ไม่ได้ลงทะเบียนล่วงหน้า |
| **Action** | เมื่อสแกน QR นักศึกษาที่ไม่ได้ลงทะเบียน ระบบเสนอ walk-in registration |
| **Benefit** | รองรับผู้เข้าร่วมกิจกรรมแบบไม่ได้นัดหมาย |
| **Technical** | `walkInsEnabled` + `quotaWalkIn` fields; สร้าง attendance `method='walk-in'` |
| **Quota** | walk-in quota แยกจาก pre-register quota; ใช้ Row Lock กัน race condition |
| **Implementation** | ScannerService.processScan() (walk-in branch) |

---

### IMP-QR-06 — Individual Point Award/Deduction at Scanner
| | |
|:---|:---|
| **Actor** | SMO, Admin, Registration, Organizer |
| **Action** | ให้หรือตัดคะแนนส่วนตัวนักศึกษาผ่านหน้า scanner |
| **Benefit** | รางวัลหรือบทลงโทษสำหรับพฤติกรรมในงาน |
| **Technical** | `action: 'score'`, delta -500 ถึง +500 (non-zero int); บันทึก audit log |
| **Role Gate** | Club/Major President ไม่มีสิทธิ์ให้คะแนน; เฉพาะ SMO/Admin/Registration/Organizer |
| **Implementation** | ScannerService.processScan() (score branch), `src/lib/admin-access.ts` |

---

### IMP-QR-07 — QR Dark Mode Fix
| | |
|:---|:---|
| **Actor** | นักศึกษา (โทรศัพท์ Dark Mode) |
| **Action** | QR Code แสดงผล color scheme ที่สแกนได้บนโหมดมืด |
| **Benefit** | ป้องกัน QR ดำบนพื้นดำ |
| **Implementation** | PR #49 |

---

### IMP-QR-08 — Custom Day Selector for Scanner
| | |
|:---|:---|
| **Actor** | SMO, Club/Major President, Registration, Organizer, Admin |
| **Action** | เลือกวันของกิจกรรมจาก Custom Dropdown แทนตัวเลือก native ของบราวเซอร์ |
| **Benefit** | UI สวยงามกลมกลืนกับระบบ และลดข้อผิดพลาดในการเลือกวันสแกนเช็คอิน |
| **Technical** | Custom Dropdown UI (button + chevron + popover + checkmark) แสดงคำว่า "Day N — <Date>" และมี Click-outside handler สำหรับปิด |
| **Implementation** | PR #53, `/app/admin/scanner/page.tsx` |

---

## 3. Event Management

### IMP-EVT-01 — Event CRUD (Create/Edit/Delete)
| | |
|:---|:---|
| **Actor** | Admin, Registration, Organizer |
| **Action** | สร้าง/แก้ไข/ลบกิจกรรม พร้อมตั้งค่า quota, ช่วงเวลา, คะแนน, poster images, role/major restrictions |
| **Technical** | ฟิลด์หลัก: title, description, startTime, endTime, registrationOpenTime, registrationCloseTime, quota, pointsAwarded, imageUrl, imageUrls (jsonb), walkInsEnabled, quotaWalkIn, targetThai/International, quotaThai/International, allowedRoles (jsonb), allowedMajors (jsonb) |
| **Implementation** | `/api/admin/events/route.ts`, `/api/admin/events/[id]/route.ts` |

---

### IMP-EVT-02 — Event Multi-Image Poster Gallery
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | อัปโหลด poster หลายรูปต่อกิจกรรมหนึ่งรายการ |
| **Benefit** | แสดง event detail ใน carousel; backward compatible กับ single image |
| **Technical** | `imageUrls` (jsonb array); `imageUrl` mirrors `imageUrls[0]` |
| **Implementation** | `/api/admin/events/route.ts` (POST normalization) |

---

### IMP-EVT-03 — Event Registration (Student)
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | ลงทะเบียนกิจกรรมด้วยคลิกเดียว; ระบบตรวจสอบ quota, ช่วงเวลา, eligibility |
| **Benefit** | จองที่นั่งในกิจกรรม |
| **Technical** | สร้าง attendance row `status='registered', method='pre-registered'`; Row Lock กัน race condition |
| **การตรวจสอบ** | profile complete, registration window, role allowed, major allowed, quota not full |
| **Implementation** | `/api/events/[id]/register/route.ts` |

---

### IMP-EVT-04 — Major-Based Registration Restriction
| | |
|:---|:---|
| **Actor** | Admin (กำหนด), ระบบ (บังคับ) |
| **Action** | กิจกรรมสามารถจำกัดเฉพาะนักศึกษาสาขาที่กำหนด |
| **Benefit** | งานสาขาไม่ปะปนกับงานทั่วไป |
| **Technical** | `allowedMajors` (jsonb string[]); ตรวจสอบ AND กับ `allowedRoles` |
| **Implementation** | PR #35, `/api/events/[id]/register/route.ts` |

---

### IMP-EVT-05 — Registration Close Lock & Confirm Un-register
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | ยกเลิกการลงทะเบียนได้ก่อนปิดรับ; หลังจากนั้นถูกล็อก; มี confirm dialog |
| **Benefit** | ป้องกันยกเลิกเผลอ; ล็อก quota เมื่อถึงวันงาน |
| **Implementation** | PR #19 |

---

### IMP-EVT-06 — Pre-test Gate After Registration
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | บังคับทำ K_pre pre-test หลังลงทะเบียนกิจกรรมบางประเภท |
| **Benefit** | วัดความรู้ก่อนงาน |
| **Technical** | Flag บน event ว่า requires pre-test |
| **Implementation** | PR #36 |

---

### IMP-EVT-07 — Pre-test Reset on Un-Register
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | เมื่อยกเลิกการลงทะเบียน K_pre pre-test จะถูกรีเซ็ต พร้อมแสดงคำเตือนก่อน discard |
| **Benefit** | ป้องกัน pre-test score ลอยค้างอยู่โดยไม่มีงาน |
| **Implementation** | PR #37 |

---

### IMP-EVT-08 — Event Attendance Export (CSV)
| | |
|:---|:---|
| **Actor** | Admin, Registration, Super-Admin |
| **Action** | Export รายชื่อผู้เข้าร่วมกิจกรรมทั้งหมดเป็น CSV |
| **Benefit** | ส่งออกข้อมูลสำหรับรายงานภายนอก |
| **Technical** | BOM-prefixed UTF-8 (รองรับภาษาไทยใน Excel); audit-logged |
| **Implementation** | `/api/admin/dashboard/route.ts?type=csv` |

---

### IMP-EVT-09 — Dashboard Walk-In Check-Ins Display
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | เห็นประวัติเช็คอินแบบ manual/walk-in บน dashboard รวมถึงกิจกรรม restricted |
| **Benefit** | แสดงประวัติเช็คอินครบถ้วน |
| **Implementation** | PR #45 |

---

### IMP-EVT-10 — Multi-Day & Multi-Session Event Check-In
| | |
|:---|:---|
| **Actor** | นักศึกษา, Admin |
| **Action** | ลงทะเบียนและเช็คอินกิจกรรมแยกตามแต่ละวัน/รอบได้ (เช่น กิจกรรม 2 วันอย่าง CAMT LINK) |
| **Benefit** | บันทึกประวัติและตรวจสอบการเข้าร่วมกิจกรรมแบบหลายวันได้แม่นยำ ไม่รวมคะแนนซ้ำซ้อน |
| **Technical** | ตาราง `event_sessions` สำหรับเก็บหลายเซสชันของกิจกรรม; สลับ Unique Constraint จาก `(event_id, student_id)` → `(session_id, student_id)` เพื่อรองรับการเช็คอินแยกวัน; โหมดการลงทะเบียนแบบ 'once' (ลงทะเบียนครั้งเดียวเช็คอินได้ทุกเซสชัน) |
| **Implementation** | PR #52, `/api/admin/events/route.ts`, `/api/events/[id]/register/route.ts` |

---

## 4. Evaluation Forms (KAS)

### IMP-FORM-01 — Form Types (K_pre, K_post, A, S)
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | สร้างแบบฟอร์มประเมินต่อกิจกรรม เลือก type และคำถาม |
| **Types** | K_pre (ความรู้ก่อนงาน), K_post (ความรู้หลังงาน), A (ทัศนคติ/satisfaction), S (ทักษะ — gate เฉพาะ roles/users) |
| **Technical** | questions (jsonb), formType, sortOrder, opensAt/closesAt (nullable), assignedRoles/assignedUserIds (jsonb), pointsAwarded, isActive, isAwarded |
| **Implementation** | `/api/admin/forms/route.ts`, `/api/admin/events/[id]/form/route.ts` |

---

### IMP-FORM-02 — Question Types
| | |
|:---|:---|
| **Actor** | Admin (สร้าง), นักศึกษา (ตอบ) |
| **Question Types** | long text, 1–5 star rating, radio, multi-select checkbox, file upload (image/PDF) |
| **Technical** | Format: `{id, type, label, required, ...options}`; scoring: star ratings auto-grade |
| **Implementation** | `src/lib/form-schema.ts` (normalizeForm, computeScore, isQuestionVisible) |

---

### IMP-FORM-03 — File Upload Answer Type (image/PDF)
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | อัปโหลดไฟล์รูปหรือ PDF เป็นคำตอบในแบบฟอร์มประเมิน |
| **Benefit** | เก็บหลักฐานภาพถ่ายหรือเอกสารประกอบ |
| **Technical** | `/api/forms/upload` สร้าง UUID.ext key; เก็บใน private bucket; เข้าถึงผ่าน auth-gated endpoint |
| **Implementation** | PR #38, `/api/forms/upload/route.ts`, `/api/forms/file/[submissionId]/route.ts` |

---

### IMP-FORM-04 — Section Branching (Conditional Questions)
| | |
|:---|:---|
| **Actor** | ระบบ (Form Engine) |
| **Action** | ข้ามคำถาม/เซกชันตามเงื่อนไขคำตอบก่อนหน้า |
| **Benefit** | ประเมินความรู้เฉพาะเส้นทางของนักศึกษา; ฟอร์มสั้นลง |
| **Technical** | JSON Question v2: `visibleIf`, `targetSection` fields; `isQuestionVisible()` evaluator |
| **Implementation** | `src/lib/form-schema.ts` |

---

### IMP-FORM-05 — Form Submission & Deduplication
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | ส่งคำตอบแบบฟอร์ม; ระบบป้องกันการส่งซ้ำ |
| **Technical** | Unique index on `(formId, studentId)`; reject duplicate ที่ DB level |
| **Implementation** | `/api/events/[id]/form/route.ts` (POST) |

---

### IMP-FORM-06 — Attendance Gate for Forms
| | |
|:---|:---|
| **Actor** | ระบบ |
| **Action** | บล็อกนักศึกษาที่ไม่ได้เช็คอินจากการทำแบบฟอร์ม |
| **Benefit** | คะแนนมาจากผู้เข้าร่วมจริงเท่านั้น |
| **Technical** | ตรวจสอบ `attendance.status='attended'` ก่อนแสดงฟอร์ม |
| **Implementation** | `/api/events/[id]/form/route.ts` (GET, hasAttended check) |

---

### IMP-FORM-07 — Form Open/Close Window
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | ตั้ง `opensAt`/`closesAt` timestamp เพื่อกำหนดช่วงเวลาทำฟอร์ม |
| **Benefit** | เปิดรับหลังจากงานจบ; ปิดรับตามกำหนด |
| **Technical** | Outside window → ฟอร์ม read-only สำหรับนักศึกษา; Admin ยังดู/แก้ไขได้ |
| **Implementation** | `src/lib/form-access.ts` (getFormAvailability) |

---

### IMP-FORM-08 — Auto-Award Points on Form Close
| | |
|:---|:---|
| **Actor** | ระบบ (Cron) |
| **Action** | เมื่อ `closesAt` ผ่านแล้ว ล็อกฟอร์มและแจก points ให้ผู้ submit ทุกคนอัตโนมัติ |
| **Benefit** | Gamify form completion; แจก house points อัตโนมัติ |
| **Technical** | `isAwarded` flag ป้องกัน re-run; Advisory Lock key=728194 |
| **Implementation** | `/api/cron/award-points/route.ts`, `src/lib/award-points.ts` |

---

### IMP-FORM-09 — S-Form Role/User Gating
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | กำหนดให้ S-form เห็นเฉพาะ roles หรือ user IDs ที่ระบุ |
| **Benefit** | Skill form สำหรับทีมงาน/กลุ่มเป้าหมายเท่านั้น |
| **Technical** | `assignedRoles` (jsonb string[]), `assignedUserIds` (jsonb string[]) |
| **Implementation** | `src/lib/form-access.ts` (canAccessSkillForm) |

---

### IMP-FORM-10 — Submissions Export with Contact Columns
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | Export form submissions เป็น CSV พร้อม contact columns (เบอร์โทร, ไลน์) |
| **Benefit** | ดึงข้อมูลติดต่อผู้ส่งแบบฟอร์ม |
| **Technical** | Auto-grow question/section textareas ใน admin form builder |
| **Implementation** | PR #43 |

---

### IMP-FORM-11 — Multiline Questions Support
| | |
|:---|:---|
| **Actor** | Admin, นักศึกษา |
| **Action** | คำถามและ section header รองรับข้อความหลายบรรทัด |
| **Implementation** | PR #42 |

---

## 5. Leaderboard & House Points

### IMP-HOUSE-01 — House Assignment (Auto-Balanced)
| | |
|:---|:---|
| **Actor** | ระบบ |
| **Action** | สร้าง/บำรุง houses 4 บ้าน; assign นักศึกษาใหม่ไปบ้านที่มีสมาชิกน้อยที่สุด |
| **Benefit** | สมดุลจำนวนสมาชิกแต่ละบ้าน; ความยุติธรรมในการแข่งขัน |
| **Technical** | `HousesService.pickBalancedHouseId()` |
| **Implementation** | `/api/admin/houses/route.ts`, `src/modules/houses/houses.service.ts` |

---

### IMP-HOUSE-02 — Event-Winner Bonus Points
| | |
|:---|:---|
| **Actor** | ระบบ (post-event) |
| **Action** | หลังกิจกรรมสิ้นสุด แจก bonus points ให้บ้านที่มีผู้เข้าร่วมมากที่สุด |
| **Benefit** | จูงใจให้นักศึกษาเข้าร่วมงาน |
| **Technical** | `checkAndAwardPastEventPoints()`; Advisory Lock key=728193; บันทึก `winnerAwardedAt` ป้องกัน re-run |
| **Implementation** | `src/lib/award-points.ts` |

---

### IMP-HOUSE-03 — Manual House Point Adjustment
| | |
|:---|:---|
| **Actor** | Super-Admin, Admin |
| **Action** | ปรับคะแนนรวมของบ้านพร้อมระบุเหตุผล |
| **Benefit** | แก้ไขข้อผิดพลาด; รางวัลนอกแพลตฟอร์ม |
| **Technical** | Delta bounded -10,000 ถึง +10,000 ต่อ request; Transaction: update points + insert scoreHistory + audit log |
| **Implementation** | `/api/admin/houses/points/route.ts` |

---

### IMP-HOUSE-04 — Live House Leaderboard
| | |
|:---|:---|
| **Actor** | นักศึกษา, Admin |
| **Action** | ดูอันดับบ้าน sorted by points (DESC) แบบ real-time |
| **Technical** | Cache: `public, s-maxage=30, stale-while-revalidate=60` |
| **Implementation** | `/api/houses/route.ts` |

---

### IMP-HOUSE-05 — House Activity Feed (Score History)
| | |
|:---|:---|
| **Actor** | นักศึกษา, Admin |
| **Action** | ดู 20 รายการ score history ล่าสุดของแต่ละบ้าน |
| **Benefit** | ติดตาม events/activities ที่สร้างคะแนน |
| **Technical** | scoreHistory table; ordered by timestamp DESC; auth-required (reasons อาจมีชื่อนักศึกษา) |
| **Implementation** | `/api/houses/activity/route.ts` |

---

### IMP-HOUSE-06 — House Member Roster
| | |
|:---|:---|
| **Actor** | นักศึกษา, Admin |
| **Action** | ดูรายชื่อสมาชิกทุกคนในบ้าน |
| **Implementation** | `/api/houses/[houseId]/members/route.ts`, PR #13 |

---

### IMP-HOUSE-07 — Leaderboard LINE CTA & Member Pagination
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | กดเข้าร่วมกลุ่ม LINE ของบ้านผ่านปุ่ม CTA และดูรายชื่อสมาชิกบ้านแบบแบ่งหน้าละ 50 คน |
| **Benefit** | เพิ่มการมีส่วนร่วมในบ้าน และลดภาระการโหลดข้อมูลสมาชิกจำนวนมากลงหน้าเดียว |
| **Technical** | LINE group invite button บน leaderboard และหน้าสมาชิก; client-side pagination (50 items/page) โดยคง Top-3 Podium บนหน้าแรก; i18n keys สำหรับ 4 ภาษา |
| **Implementation** | PR #54, `/app/dashboard/houses/[houseId]/page.tsx` |

---

### IMP-HOUSE-08 — House Recoloring & Mascot Assets
| | |
|:---|:---|
| **Actor** | ระบบ (Database) |
| **Action** | อัปเดตเฉดสีประจำบ้านให้ดูสวยงามทันสมัย พร้อมมาสคอตใหม่ |
| **Benefit** | ปรับภาพลักษณ์บ้านให้พรีเมียมขึ้น: แดง (Mom), เงิน/เทาอมฟ้า (To), น้ำเงิน (Luang), เขียว (Makon) |
| **Technical** | `scripts/recolor-houses.mjs` สคริปต์อัปเดตสีบ้านใน DB แบบ idempotent; อัปเดต CSS variables และชุดสีคงที่; เปลี่ยนไฟล์ mascot PNGs ใหม่ทั้งหมด |
| **Implementation** | PR #55, `scripts/recolor-houses.mjs`, `globals.css` |

---

## 6. Merch Shop

### IMP-SHOP-01 — Shop Settings (Payment Config)
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | ตั้งค่า payment info (PromptPay/ธนาคาร), QR image URL, เปิด-ปิดร้านค้า |
| **Technical** | Singleton upsert pattern ใน `shopSettings` table |
| **Implementation** | `/api/admin/shop/settings/route.ts` |

---

### IMP-SHOP-02 — Product Catalog with Variants & Stock
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | สร้างสินค้าพร้อม variant ขนาด, stock แยกต่อ variant, sale window |
| **Technical** | shopProducts + shopVariants (stock nullable = unlimited; Row Lock กัน overselling) |
| **Implementation** | `/api/admin/shop/products/route.ts` |

---

### IMP-SHOP-03 — Order Placement with Slip Upload
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | สั่งซื้อสินค้า, อัปโหลดสลิปการโอนเงิน |
| **Technical** | POST `/api/shop/orders` (validate stock, FOR UPDATE lock); slip ใน private bucket |
| **Per-buyer limits** | `maxPerOrder` field บน product |
| **Implementation** | `/api/shop/orders/route.ts`, `/api/shop/slip/route.ts` |

---

### IMP-SHOP-04 — Order Review & Approve/Reject
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | ดู pending orders; approve/reject พร้อม optional reason |
| **Technical** | PUT `/api/admin/shop/orders/[id]` → status: pending → approved/rejected |
| **Implementation** | `/api/admin/shop/orders/[id]/route.ts` |

---

### IMP-SHOP-05 — Slip Access Control (Private Storage)
| | |
|:---|:---|
| **Actor** | นักศึกษา (ของตัวเอง), Admin (ทั้งหมด) |
| **Action** | ดาวน์โหลดสลิปผ่าน auth-gated endpoint เท่านั้น |
| **Benefit** | ข้อมูลสลิป (ชื่อ, บัญชีธนาคาร) ไม่รั่วไหลสู่สาธารณะ |
| **Implementation** | `/api/shop/orders/[id]/slip/route.ts` |

---

## 7. Admin Dashboard & Tools

### IMP-ADMIN-01 — Dashboard Overview Stats
| | |
|:---|:---|
| **Actor** | Admin, Registration, Organizer |
| **Action** | ดูสถิติ: check-ins วันนี้, นักศึกษาลงทะเบียน, กิจกรรมที่ active |
| **Technical** | Bangkok timezone (UTC+7) สำหรับคำนวณ "วันนี้" |
| **Implementation** | `/api/admin/dashboard/route.ts` |

---

### IMP-ADMIN-02 — Student Directory
| | |
|:---|:---|
| **Actor** | Admin, Registration |
| **Action** | ดูรายชื่อนักศึกษาทั้งหมดพร้อมข้อมูลพื้นฐาน |
| **PDPA** | Bulk endpoint ไม่ส่งข้อมูลโทรศัพท์/ข้อมูลอ่อนไหว; detail route เปิดเฉพาะ super_admin |
| **Implementation** | `/api/admin/students/route.ts` |

---

### IMP-ADMIN-03 — Manage User Modal (Edit Profile)
| | |
|:---|:---|
| **Actor** | Admin |
| **Action** | แก้ไขข้อมูลโปรไฟล์นักศึกษารายบุคคลผ่าน modal |
| **Technical** | Mobile-friendly; รองรับ prefix field; admin bypass validation บางส่วน |
| **Implementation** | PR #28 |

---

### IMP-ADMIN-04 — Announcement Banner Editor
| | |
|:---|:---|
| **Actor** | Admin, Super-Admin |
| **Action** | สร้าง/แก้ไข/เปิด-ปิด แถบประกาศบน Dashboard ของนักศึกษา |
| **Technical** | Singleton upsert; rich-text markup (bold, links, colors) via `parseRichText()` |
| **Implementation** | `/api/admin/announcement/route.ts` |

---

### IMP-ADMIN-05 — Audit Log Viewer
| | |
|:---|:---|
| **Actor** | Super-Admin, Admin |
| **Action** | ดู audit log ที่ไม่สามารถแก้ไขได้ของการกระทำ admin ทั้งหมด |
| **Implementation** | `/api/admin/audit-logs/route.ts` |

---

### IMP-ADMIN-06 — Profile Full Name Editable
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | แก้ไขชื่อ-นามสกุลได้หลัง onboarding เสร็จแล้ว |
| **Implementation** | PR #44 |

---

## 8. PDPA & Medical Data Handling

### IMP-PDPA-01 — Explicit PDPA Consent
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | ยินยอม PDPA ก่อนกรอกข้อมูลสุขภาพระหว่าง onboarding |
| **Technical** | `pdpaConsent` boolean column; required ก่อน `profileCompleted = true` |
| **Implementation** | `/app/onboarding/` form, `/api/profile/route.ts` |

---

### IMP-PDPA-02 — Medical Signal vs. Detail Visibility
| | |
|:---|:---|
| **Actor** | Scanner (non-admin) — เห็น boolean; Admin — เห็นรายละเอียด |
| **Action** | แยกข้อมูลสุขภาพออกเป็น 2 ระดับ |
| **Technical** | `canViewMedicalDetail = role === "super_admin" \|\| role === "admin"` |
| **Implementation** | `/api/admin/scan/route.ts` (response shaping) |

---

### IMP-PDPA-03 — Medical Category Labels (Translated)
| | |
|:---|:---|
| **Actor** | Scanner |
| **Action** | สัญญาณสุขภาพแสดงเป็น category labels ที่แปลแล้ว (มีโรคประจำตัว / ต้องการยาฉุกเฉิน) |
| **Implementation** | PR #18 |

---

### IMP-PDPA-04 — Medical Data API Restrictions
| | |
|:---|:---|
| **Actor** | API Server |
| **Action** | Exclude ข้อมูลสุขภาพจาก student-facing responses; รวมเฉพาะใน admin/super_admin paths |
| **Implementation** | ทุก route handler ที่ return user data |

---

## 9. Audit Log & Tamper Evidence

### IMP-AUDIT-01 — Append-Only Audit Log
| | |
|:---|:---|
| **Actor** | ระบบ |
| **Action** | บันทึกทุก admin action: actor, target, action text, IP, timestamp |
| **Technical** | ไม่มี FK ไปยัง users (รองรับ user deletion); ไม่มี soft-delete |
| **Implementation** | `src/modules/audit/audit.service.ts` (AuditService.logAction) |

---

### IMP-AUDIT-02 — SHA-256 Hash Chain
| | |
|:---|:---|
| **Actor** | ระบบ |
| **Action** | แต่ละ audit row มี hash เชื่อมกับ row ก่อนหน้า |
| **Benefit** | ตรวจพบ tampering (แก้ไข, ลบ, insert, reorder) |
| **Technical** | `computeRowHash()` hashes `[id, timestamp, actorId, targetId, action, ipAddress, prevHash]`; GENESIS_HASH = "0"*64 |
| **Implementation** | `src/modules/audit/audit.service.ts` |

---

### IMP-AUDIT-03 — Advisory Lock for Chain Serialization
| | |
|:---|:---|
| **Actor** | Database (Postgres) |
| **Action** | Serialize audit appends ด้วย `pg_advisory_xact_lock` |
| **Benefit** | รับประกัน chain integrity ภายใต้ concurrent load |
| **Technical** | Lock key=919273; held for transaction duration |
| **Implementation** | `src/modules/audit/audit.service.ts` (line 80) |

---

### IMP-AUDIT-04 — Chain Verification Report
| | |
|:---|:---|
| **Actor** | Super-Admin |
| **Action** | ตรวจสอบ hash chain integrity; รายงานการ tamper |
| **Output** | `{valid, totalRows, hashedRows, firstBreakIndex, reason}` |
| **Implementation** | `/api/admin/audit-verify/route.ts`, `AuditService.verifyChainIntegrity()` |

---

## 10. Live Notifications (SSE)

### IMP-NOTIF-01 — Check-In Pop-Up Notification
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | ได้รับ pop-up บน dashboard เมื่อถูกเช็คอินในกิจกรรม |
| **Benefit** | Feedback ทันที; รู้ว่า attendance ถูกบันทึก |
| **Technical** | GET `/api/notifications`; lookback 5 นาที; cold-start 90 วินาที |
| **Implementation** | `/api/notifications/route.ts` (PR #46) |

---

### IMP-NOTIF-02 — Digital ID Check-In Modal
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | Modal pop-up บนหน้า Digital ID ทันทีเมื่อถูกเช็คอินหรือได้รับ/ถูกหักคะแนน |
| **Implementation** | PR #47 |

---

### IMP-NOTIF-03 — Individual Point Award Notification
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | ได้รับ notification เมื่อ admin ให้หรือตัดคะแนนส่วนตัว |
| **Technical** | Parse audit logs ด้วย `SCORE_ACTION` regex; extract delta + activity title |
| **Implementation** | `/api/notifications/route.ts` (SCORE_ACTION regex) |

---

### IMP-NOTIF-04 — Notification Polling with Since Parameter
| | |
|:---|:---|
| **Actor** | Client (student) |
| **Action** | Poll notifications ด้วย `?since=<ISO timestamp>` เพื่อดึงเฉพาะ items ใหม่ |
| **Technical** | Server clamps to lookback floor เพื่อป้องกัน client เก่าขยาย scan window |
| **Implementation** | `/api/notifications/route.ts` |

---

### IMP-NOTIF-05 — Professional Notification Icons
| | |
|:---|:---|
| **Actor** | นักศึกษา |
| **Action** | Notification ใช้ Lucide icons แทน emoji |
| **Implementation** | PR #48 |

---

## 11. Role-Based Access Control (RBAC)

### IMP-RBAC-01 — Role Hierarchy (12 Levels)
| | |
|:---|:---|
| **Priority** | super_admin > admin > registration > organizer > smo > anusmo > club_president > major_president > staff > professor > officer > student |
| **Technical** | `ROLE_PRIORITY` array; `getPrimaryRole()` เลือก role สูงสุด |
| **Implementation** | `src/auth.ts` |

---

### IMP-RBAC-02 — Admin Area Entry Gating
| | |
|:---|:---|
| **Allowed Roles** | super_admin, admin, registration, organizer, smo, club_president, major_president |
| **Implementation** | `src/lib/admin-access.ts` (canEnterAdmin), `src/proxy.ts` |

---

### IMP-RBAC-03 — Scanner-Only Confinement (SMO, Presidents)
| | |
|:---|:---|
| **Actor** | Middleware |
| **Action** | SMO, club_president, major_president ถูก redirect ไป `/admin/scanner` เมื่อเข้า `/admin/*` อื่น |
| **Implementation** | `src/proxy.ts`, `src/lib/admin-access.ts` (isScannerOnlyRole) |

---

### IMP-RBAC-04 — Club & Major President Scanner Roles
| | |
|:---|:---|
| **Actor** | Club President, Major President |
| **Action** | สแกนเช็คอินได้แต่ **ไม่สามารถให้/ตัดคะแนน**; role ใหม่ใน RBAC |
| **Implementation** | PR #34 |

---

### IMP-RBAC-05 — Organizer Access Restriction
| | |
|:---|:---|
| **Actor** | Organizer |
| **Action** | ถูก redirect ออกจาก `/admin/students` ไปยัง `/admin/dashboard` |
| **Implementation** | `src/proxy.ts` (lines 73–75) |

---

### IMP-RBAC-06 — Rate Limiting (Scanner)
| | |
|:---|:---|
| **Actor** | API Server |
| **Action** | จำกัด 300 requests/min ต่อ IP สำหรับ scanner endpoint |
| **Implementation** | `/api/admin/scan/route.ts`, `src/lib/rate-limit.ts` |

---

### IMP-RBAC-07 — Read-Only Attendance Access for Scanner Roles
| | |
|:---|:---|
| **Actor** | SMO, Club/Major President |
| **Action** | เข้าดูรายชื่อและประวัติการเข้าร่วมกิจกรรมได้ (Read-Only) ผ่านหน้าแอดมิน เพื่อความสะดวกในการดูแลกิจกรรม |
| **Benefit** | ตรวจสอบการเข้าร่วมกิจกรรมได้สะดวกรวดเร็ว แต่รักษาความปลอดภัย PDPA ของข้อมูลนักศึกษา |
| **Technical** | ปรับปรุง `admin-access.ts` และ `proxy.ts` ให้เข้าถึงเฉพาะหน้า `/admin/events` (แบบสิทธิ์ดูเท่านั้น) และจำกัด API ดึงข้อมูล Rosters โดยคัดกรองเบอร์โทรศัพท์, ข้อมูลการแพทย์ และข้อมูลผู้ติดต่อฉุกเฉินออกฝั่งเซิร์ฟเวอร์ |
| **Implementation** | PR #56, `src/lib/admin-access.ts`, `/api/admin/events/[id]/attendance/route.ts` |

---

## 12. Background Tasks (Cron Jobs)

### IMP-CRON-01 — Award Points Cron Job
| | |
|:---|:---|
| **Actor** | ระบบ (scheduled) |
| **Action** | รัน event-winner + form-close awards เป็นระยะ |
| **Technical** | POST `/api/cron/award-points`; Advisory Locks แยกกัน (728193 events, 728194 forms) |
| **Implementation** | `/api/cron/award-points/route.ts`, `src/lib/award-points.ts` |

---

### IMP-CRON-02 — Form File Garbage Collection
| | |
|:---|:---|
| **Actor** | ระบบ (scheduled) |
| **Action** | ลบไฟล์ที่อัปโหลดใน forms แต่ไม่มี submission อ้างอิงอยู่ |
| **Benefit** | ลด storage cost; ล้างข้อมูลที่ไม่จำเป็น |
| **Implementation** | `/api/cron/gc-form-files/route.ts`, `src/lib/form-file-gc.ts` (PR #39) |

---

## ตาราง Matrix: Feature × Role

| Feature | student | smo | club/major president | registration | organizer | admin | super_admin |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Sign-in / Onboarding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View QR Code | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| QR Scanner (check-in) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Individual Score Award | — | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Register Events | ✓ | — | — | — | — | — | — |
| View Event Attendance (Read-Only) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create/Edit Events | — | — | — | ✓ | ✓ | ✓ | ✓ |
| Fill Forms | ✓ | — | — | — | — | — | — |
| Create Forms | — | — | — | — | ✓ | ✓ | ✓ |
| View Leaderboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Buy Merch | ✓ | — | — | — | — | — | — |
| Manage Shop Orders | — | — | — | — | — | ✓ | ✓ |
| View Student Directory | — | — | — | ✓ | — | ✓ | ✓ |
| Edit Announcements | — | — | — | — | — | ✓ | ✓ |
| Adjust House Points | — | — | — | — | — | ✓ | ✓ |
| View Full Medical Detail | — | — | — | — | — | ✓ | ✓ |
| View Medical Signal (boolean) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View Audit Logs | — | — | — | — | — | ✓ | ✓ |
| Verify Audit Chain | — | — | — | — | — | — | ✓ |

---

## Related Documents
- [01-product-backlog.md](./01-product-backlog.md) — Product Backlog (planned user stories)
- [02-sprint-planning.md](./02-sprint-planning.md) — Sprint Roadmap
- [../software/01-system-design.md](../software/01-system-design.md) — System Architecture
- [../software/03-data-schema.md](../software/03-data-schema.md) — Database Schema
