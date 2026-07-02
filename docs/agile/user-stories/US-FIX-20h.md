# User Story: US-FIX-20h - DB Config Safety: ตัด Fallback URL อันตรายและ Gate PGlite เฉพาะ Development

**Status:** 📝 Planned (รอพัฒนา)
**Epic:** [P2P Game Hardening & Production Readiness (Recheck Report 2026-07-02)](../report/2026-07-02-p2p-game-recheck.md)
**Priority:** 🟠 Moderate ⚡ Quick win (~ไม่กี่บรรทัด) — ไม่ขึ้นกับ story อื่น ทำได้ทันที
**Owner:** Developer
**Version:** 1.0 | **Last Updated:** 2026-07-02

---

## 📖 Description
**ในฐานะ** ผู้ดูแลระบบ
**ฉันต้องการ** ให้ชั้นเชื่อมต่อฐานข้อมูล (`src/db/index.ts`) ล้มเหลวแบบ "ดังและชัดเจน" เมื่อ config ผิด แทนที่จะเงียบๆ ต่อไปยังฐานข้อมูลผิดตัว
**เพื่อให้** ความผิดพลาดในการตั้งค่า env บน production ถูกตรวจพบทันทีตอน deploy ไม่ใช่ค้นพบทีหลังว่าแอปวิ่งอยู่บนฐานข้อมูลเปล่า

## 🐛 ที่มาของปัญหา (จาก Recheck Report — FIX-9)
1. มีการเพิ่ม fallback `postgres(process.env.DATABASE_URL || "postgresql://localhost:5432/activecamt_prod", ...)` — เดิมใช้ `DATABASE_URL!` ซึ่ง crash ทันทีเมื่อ env หาย ตอนนี้ถ้า prod ลืมตั้ง env แอปจะพยายามต่อ `localhost` แบบเงียบๆ
2. เงื่อนไข `DB_TYPE === "pglite"` ไม่ gate ด้วย environment — ถ้าตัวแปรนี้หลุดเข้า production แอปทั้งระบบจะรันบน PGlite (WASM in-process DB) ที่ว่างเปล่า โดยไม่มี error ใดๆ ผู้ใช้จะเห็นข้อมูลหายทั้งหมด

---

## ✅ Acceptance Criteria
1. [ ] เมื่อ `DATABASE_URL` ไม่ถูกตั้งและไม่ได้ใช้ pglite → โปรเซส throw ทันทีตอน init พร้อมข้อความชัดเจน (ไม่มี fallback URL ใดๆ)
2. [ ] `DB_TYPE=pglite` มีผลเฉพาะเมื่อ `NODE_ENV !== "production"` — ถ้าถูกตั้งใน production ให้ throw พร้อมข้อความอธิบาย (fail-fast ไม่ใช่ silently ignore)
3. [ ] พฤติกรรม dev ปกติ (pglite ZeroSetup และ local postgres) ยังทำงานเหมือนเดิม — `run-local.ps1` ทั้งสองโหมดใช้ได้
4. [ ] `npm run build` และ `test-db.ts` ผ่านทั้งโหมด pglite และ postgres

## 🛠 Technical Tasks (งานพัฒนาที่ต้องทำ)
- [ ] แก้ `src/db/index.ts`: คืนการใช้ `process.env.DATABASE_URL` แบบบังคับ (throw ถ้าไม่มี) ในสาขา postgres
- [ ] เพิ่ม guard สาขา pglite: `if (NODE_ENV === "production") throw new Error(...)`
- [ ] ตรวจ `test-db.ts` ให้สอดคล้องกับ guard ใหม่
- [ ] ทดสอบ 4 กรณี: dev+pglite ✓, dev+postgres ✓, ไม่มี DATABASE_URL → throw, prod+DB_TYPE=pglite → throw

## 🔗 Related Files
- Report: [Recheck Report 2026-07-02](../report/2026-07-02-p2p-game-recheck.md) (FIX-9)
- Code: `src/db/index.ts`, `test-db.ts`, `run-local.ps1`
