# User Story: US-FIX-20b - Harden Dev Login Bypass ไม่ให้กระทบฐานข้อมูลจริง

**Status:** 📝 Planned (รอพัฒนา)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🔴 Crucial — ทำขนานกับ US-FIX-20a ได้ทันที
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** นักพัฒนาระบบ
**ฉันต้องการ** ให้ Dev Login Bypass (Credentials provider ใน `src/auth.ts`) ใช้งานได้เฉพาะสภาพแวดล้อม local ที่ปลอดภัยเท่านั้น และไม่เขียน role ลงฐานข้อมูลที่เป็น production
**เพื่อให้** ทีมยังทดสอบ role ต่างๆ ได้สะดวก โดยไม่มีความเสี่ยงที่จะสร้าง user ปลอมหรือแก้ role ของ account จริงบน production DB และไม่มีใครใน LAN ใช้ bypass ยึด session `super_admin` ได้

## 🐛 ที่มาของปัญหา (จาก Recheck Report — FIX-2)
1. `authorize()` สร้าง/อัปเดต user ใน DB ตามค่าใน form โดยไม่ validate — `role` เป็น string อะไรก็ได้ และ default คืออีเมล super admin จริง (`smocamt.official@gmail.com`)
2. `.env` ของโปรเจคชี้ production Supabase (ตาม `src/db/guard.ts`) และ `next dev` โหลด `.env` → dev login เขียนลง **prod DB** ได้จริง
3. ไม่มี secret ป้องกัน + `allowedDevOrigins` ใน `next.config.ts` เปิดทุก IP → เครื่องอื่นใน LAN ใช้ bypass ได้
4. ที่ปลอดภัยอยู่แล้ว: provider ถูก gate ด้วย `NODE_ENV === "development"` จึงไม่ทำงานบน production build — **ต้องคงเงื่อนไขนี้ไว้**

---

## ✅ Acceptance Criteria
1. [ ] Dev bypass ทำงานเฉพาะเมื่อ `NODE_ENV === "development"` **และ** ตั้ง env flag `ENABLE_DEV_LOGIN=true` อย่างชัดเจน (ค่า default = ปิด)
2. [ ] `authorize()` ปฏิเสธการทำงาน (return null + log คำเตือน) เมื่อ `DATABASE_URL` ดูเป็น remote/production — ใช้เกณฑ์เดียวกับ `assertDestructiveAllowed()` ใน `src/db/guard.ts` (supabase.co, :6543, ฯลฯ)
3. [ ] ค่า `role` ถูก validate กับ allowlist (`student`, `smo`, `club_president`, `admin`, `super_admin`) — ค่าอื่นถูกปฏิเสธ
4. [ ] bypass **ไม่เขียน/อัปเดต role ลงตาราง users** — role ที่เลือกอยู่ใน JWT session เท่านั้น (ยอมรับได้ที่จะสร้าง user ใหม่เฉพาะกรณี DB เป็น local และไม่มี user นั้นอยู่)
5. [ ] ห้ามใช้อีเมลใน `SUPER_ADMIN_EMAILS` เป็น default ของ form ใน `LandingUI.tsx` (ใช้อีเมล dev สมมุติ เช่น `dev@localhost.test`)
6. [ ] UI ของ bypass ยังแสดงเฉพาะ development build เหมือนเดิม และมีข้อความเตือนเมื่อ flag ไม่ได้เปิด
7. [ ] ทดสอบ: (ก) prod build ไม่มี provider นี้, (ข) dev + flag ปิด → ใช้ไม่ได้, (ค) dev + flag เปิด + DATABASE_URL remote → ถูกปฏิเสธพร้อม log, (ง) dev + local DB → login ได้ทุก role ใน allowlist

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] เพิ่มเงื่อนไข `process.env.ENABLE_DEV_LOGIN === "true"` ครอบ Credentials provider ใน `src/auth.ts`
- [ ] แยก helper `isRemoteDatabase(url)` จาก regex ใน `src/db/guard.ts` แล้ว reuse ใน `authorize()`
- [ ] เพิ่ม `DEV_ROLE_ALLOWLIST` และ validate ก่อนใช้
- [ ] ตัด `db.update(users).set({ role, roles, ... })` (role sync) ออกจาก `authorize()` — คืนค่า role จาก form ลง JWT โดยตรง
- [ ] ปรับ `jwt`/`session` callback ให้ session ของ dev bypass ไม่ถูก periodic DB refresh ทับ role ที่เลือก (หรือยอมรับพฤติกรรมและระบุใน doc)
- [ ] แก้ default email/role ใน `src/components/home/LandingUI.tsx` + เพิ่มคำอธิบายการตั้ง `ENABLE_DEV_LOGIN` ใน `README.md` / `run-local.ps1`
- [ ] เขียนผลทดสอบ 4 กรณีตาม AC ข้อ 7 ลงใน PR description

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../report/2026-07-02-p2p-game-recheck.md) (FIX-2)
- Code: `src/auth.ts`, `src/components/home/LandingUI.tsx`, `src/db/guard.ts`, `next.config.ts`, `run-local.ps1`
