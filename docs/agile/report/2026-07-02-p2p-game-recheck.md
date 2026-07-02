# รายงานผลตรวจสอบ (Recheck Report): P2P Game Feature + Dev Login Bypass

**Branch ที่ตรวจ:** `report` (เทียบกับ `main`)
**วันที่ตรวจ:** 2026-07-02
**ขอบเขต:** Feature P2P Battle Game (OX) ทั้งหมด 44 ไฟล์ (~4,000 บรรทัด) — API routes, WebRTC client, DB layer, Dev Login Bypass, run-local script
**ผลสรุป:** ❌ **Needs work — ยัง merge/deploy ไม่ได้** (build ไม่ผ่าน + มีประเด็นความปลอดภัยระดับ Crucial)

---

## 1. สรุปภาพรวม (Scoreboard)

| ระดับ | จำนวน | ความหมาย |
|---|---|---|
| 🔴 Crucial | 3 | ต้องแก้ก่อน merge — build พัง / ช่องโหว่ความปลอดภัย |
| 🟠 Moderate | 6 | บั๊กจริง / ความเสี่ยงด้านประสิทธิภาพ ควรแก้ |
| 🟡 Low | 5 | ปรับปรุงเล็กน้อย เลื่อนได้ |
| ⚡ Quick wins | 3 | แก้ได้ในไม่กี่บรรทัด |

**สิ่งที่ตรวจแล้วผ่าน (Clean):**
- PDPA/Medical ✓ — feature ไม่แตะข้อมูล medical; payload เปิดเผยเฉพาะ `id/name/nickname/houseId/image` ต่อผู้ที่ login แล้ว
- Authorization ✓ — ทุก route เช็ค session + เช็คว่าเป็น host/guest ของห้อง; middleware (`src/proxy.ts`) gate `/battle` โดย default-deny
- SQL Injection ✓ — ใช้ Drizzle parameterized ทั้งหมด
- Secrets ✓ — `run-local.ps1` เจนค่า secret แบบสุ่ม ไม่มี hardcode; STUN ใช้ server สาธารณะไม่มี credential
- Game Engine ✓ — logic ของ `src/lib/games/ox.ts` ถูกต้อง, unit test ผ่าน 5/5

---

## 2. รายละเอียด Findings

### 🔴 Crucial (ต้องแก้ก่อน merge)

#### FIX-1: Branch build ไม่ผ่าน — schema ของตารางเกมไม่ถูก commit
- **ไฟล์:** `src/db/schema.ts` (ไม่มีการแก้ไขใน branch), ทุกไฟล์ใต้ `src/app/api/battle/`
- **อาการ:** ทุก route import `gameRooms` / `gameStats` / `webrtcSignals` จาก `@/db/schema` แต่ schema.ts ทั้งบน branch นี้และ main **ไม่มีตารางเหล่านี้** — `npx tsc --noEmit` พบ error 69 จุด (TS2305)
- **สาเหตุที่คาด:** นักพัฒนาแก้ schema.ts ในเครื่องแต่ลืม commit (รวม relations `host`/`guest`/`user` ที่ query ใช้)
- **แนวทางแก้:** เพิ่ม table definitions + relations ลง `src/db/schema.ts` แล้วสร้าง drizzle migration ผ่าน `npm run db:generate` (ใช้ flow `/safe-deploy`) → User Story **US-FIX-20a**

#### FIX-2: Dev Login Bypass เขียน role ลง DB จริงโดยไม่มีการป้องกัน
- **ไฟล์:** `src/auth.ts` (Credentials provider), `src/components/home/LandingUI.tsx`, `next.config.ts`
- **อาการ:**
  1. `authorize()` สร้าง user ใหม่หรือ**อัปเดต role ของ user ที่มีอยู่**ตามค่าใน form โดยไม่ validate (`role` เป็น string อะไรก็ได้)
  2. `.env` ของโปรเจคชี้ **production Supabase** (ตาม comment ใน `src/db/guard.ts`) และ `next dev` โหลด `.env` → กด dev login = เขียน user ปลอม/แก้ role ลง production DB ได้
  3. ไม่ต้องใช้ secret ใดๆ และ `allowedDevOrigins` เปิดทุก IP ในเครื่อง → คนใน LAN เดียวกันได้ session `super_admin` ทันที
- **สิ่งที่ปลอดภัยแล้ว:** production build ปิด provider ด้วยเงื่อนไข `NODE_ENV === "development"` — บน Vercel/Docker จึงไม่ถูก register
- **แนวทางแก้:** (1) เพิ่ม flag `ENABLE_DEV_LOGIN=true` ควบคู่ NODE_ENV, (2) ปฏิเสธเมื่อ `DATABASE_URL` เป็น remote/prod (reuse regex จาก `src/db/guard.ts`), (3) validate role ด้วย allowlist, (4) เลิก sync role ลง DB — ใส่ role ใน JWT อย่างเดียว → **US-FIX-20b**

#### FIX-3: Runtime DDL (`ensureGameTables`) รันจาก request path — ผิดนโยบาย migration
- **ไฟล์:** `src/db/ensure-tables.ts` + ทุก battle route
- **อาการ:** รัน `CREATE TABLE` 6 คำสั่งต่อ cold instance ผ่าน transaction pooler, ถูกเรียก**ก่อน check auth** (request ที่ไม่ login ก็ trigger ได้), และกลืน error ทิ้ง (log แล้วไปต่อ → route 500 แบบงงๆ และ retry DDL ทุก request)
- **แนวทางแก้:** ลบ `ensure-tables.ts` และการเรียกใช้ทั้งหมด แทนด้วย drizzle migration จริง (ทำพร้อม US-FIX-20a) → **US-FIX-20a**

### 🟠 Moderate (ควรแก้)

#### FIX-4: WebRTC connection ถูก teardown ทันทีที่เชื่อมต่อสำเร็จ
- **ไฟล์:** `src/app/battle/room/[code]/RoomClient.tsx` (effect keyed `[status]`)
- **อาการ:** เมื่อสถานะห้องเปลี่ยน `connecting → active` React รัน cleanup ของ effect เดิม → `cleanupWebRTC()` ปิด peer connection/data channel ที่เพิ่งต่อได้ → ตกกลับ REST polling เสมอ — ส่วน "P2P" ของ feature แทบไม่เคยทำงานจริง
- **แนวทางแก้:** แยก lifecycle ของ WebRTC ออกจาก state `status` (เช็คใน effect แต่ cleanup เฉพาะตอน unmount) → **US-FIX-20c**

#### FIX-5: ICE candidates ถูกเขียนทับแทนที่จะ append
- **ไฟล์:** `RoomClient.tsx` (`uploadIceCandidate`), `src/app/api/battle/rooms/[code]/signal/route.ts`
- **อาการ:** GET `/signal` คืนข้อมูลของ*ฝั่งตรงข้าม*เสมอ ทำให้เงื่อนไข `data.role === myRole` ไม่มีวันเป็นจริง → ทุกครั้งที่ POST จะทับ array เดิมเหลือ candidate เดียว + read-modify-write ฝั่ง client มี race
- **แนวทางแก้:** ให้ server เป็นคน append candidate (`ice_candidates || new`) โดย client ส่งทีละ candidate → **US-FIX-20d**

#### FIX-6: Race condition ใน move/finalize → สถิตินับซ้ำ, move ถูกทับ
- **ไฟล์:** `src/app/api/battle/rooms/[code]/move/route.ts`, `.../state/route.ts`, `src/lib/games/stats-helper.ts`
- **อาการ:** ไม่มี optimistic concurrency (`WHERE current_turn = X AND status = 'active'`); GET `/state` (poll ทุก 2 วิจากทั้งสองฝั่ง) และ POST `/move` ต่าง lazy-forfeit ได้พร้อมกัน → `finalizeGameInDb` ถูกเรียกซ้ำ → win/loss นับซ้ำ (stats-helper เป็น read-modify-write ไม่มี atomic increment)
- **แนวทางแก้:** update แบบมีเงื่อนไข + เช็ค affected rows, ทำ finalize ให้ idempotent, ใช้ `ON CONFLICT` upsert + atomic increment สำหรับ stats → **US-FIX-20e**

#### FIX-7: Signal payload ไม่ validate + ไม่มี cleanup ข้อมูลเก่า
- **ไฟล์:** `signal/route.ts`, ตาราง `webrtc_signals` / `game_rooms`
- **อาการ:** `sdpOffer`/`sdpAnswer`/`iceCandidates` รับอะไรก็ได้ไม่จำกัดขนาด (route อื่นในโปรเจคใช้ Zod หมด); แถวข้อมูลห้อง/สัญญาณสะสมไม่จำกัดบน free tier
- **แนวทางแก้:** Zod schema + size cap, ลบ signals เมื่อจบเกม + สคริปต์/cron ล้างห้องหมดอายุ → **US-FIX-20f**

#### FIX-8: Polling load ขัดกับข้อจำกัด free-tier
- **ไฟล์:** `RoomClient.tsx`
- **อาการ:** poll `/state` ทุก 2 วิ + signaling ทุก 1 วิ ต่อผู้เล่น และ**ยัง poll ต่อแม้ data channel ต่อสำเร็จ** — pattern เดียวกับที่เคยทำ pooler starvation จน 504 ช่วง event
- **แนวทางแก้:** หยุด/ผ่อน state-poll ขณะ WebRTC ต่ออยู่, หยุด signaling poll เมื่อ connected, backoff เป็น 5–10 วิ → **US-FIX-20g**

#### FIX-9: DB config อันตราย 2 จุด ⚡
- **ไฟล์:** `src/db/index.ts`
- **อาการ:** (1) fallback `DATABASE_URL || "postgresql://localhost:5432/activecamt_prod"` ซ่อนปัญหา env หาย — เดิม crash ดังๆ ด้วย `!`; (2) `DB_TYPE=pglite` ไม่ gate เฉพาะ dev — ถ้าหลุดเข้า prod แอปจะรันบน DB เปล่าใน WASM เงียบๆ
- **แนวทางแก้:** คืน `!` และเพิ่ม `NODE_ENV !== "production"` ให้เงื่อนไข pglite (หรือ throw ใน prod) → **US-FIX-20h**

### 🟡 Low (เลื่อนได้ — รวมใน US-FIX-20i)

| # | ประเด็น | ไฟล์ |
|---|---|---|
| L1 | Room code 4 ตัว (~1M แบบ) brute-force ได้โดย user ที่ login — ควรมี rate limit (จำไว้ว่า rate-limit.ts เป็น per-instance) | `rooms/route.ts`, `join/route.ts` |
| L2 | WebRTC แลก IP ระหว่างผู้เล่นผ่าน ICE (ธรรมชาติของ P2P) — ควรระบุใน privacy notice ก่อนเปิดใช้จริง | — |
| L3 | ทุก action ของเกมเขียนลง `audit_logs` (hash chain) — volume จะบวมเร็ว พิจารณาแยกออกจาก chain ของ medical access | `join/route.ts`, `move/route.ts` ฯลฯ |
| L4 | Types หลวม: `tx: any`, `cell as any`, พารามิเตอร์ `currentTurn` ใน `validateMove` ไม่ถูกใช้ | `stats-helper.ts`, `ox.ts`, `move/route.ts` |
| L5 | `stats/me` คืน default stats object ปลอม (`id: ""`, `lastPlayedAt: new Date()`) — ควรคืน `null` | `stats/me/route.ts` |

---

## 3. แนวทางการปรับแก้ไข (Remediation Plan)

รายการ User Stories ทั้งหมดอยู่ใน `docs/agile/user-stories/` (Epic: **US-FIX-20 — P2P Game Hardening & Production Readiness**)

| Story | เรื่อง | ระดับ | ขึ้นกับ |
|---|---|---|---|
| [US-FIX-20a](../user-stories/US-FIX-20a.md) | เพิ่ม schema + drizzle migration ตารางเกม และลบ runtime DDL | 🔴 | — (ทำก่อนทุกตัว) |
| [US-FIX-20b](../user-stories/US-FIX-20b.md) | Harden Dev Login Bypass | 🔴 | — |
| [US-FIX-20c](../user-stories/US-FIX-20c.md) | แก้ WebRTC lifecycle teardown bug | 🟠 | 20a |
| [US-FIX-20d](../user-stories/US-FIX-20d.md) | แก้ ICE candidate overwrite → server-side append | 🟠 | 20a |
| [US-FIX-20e](../user-stories/US-FIX-20e.md) | Concurrency/idempotency ของ move & finalize + atomic stats | 🟠 | 20a |
| [US-FIX-20f](../user-stories/US-FIX-20f.md) | Validate signal payload + cleanup ข้อมูลเกมเก่า | 🟠 | 20a |
| [US-FIX-20g](../user-stories/US-FIX-20g.md) | ลด polling load ให้เข้ากับ free-tier | 🟠 | 20c |
| [US-FIX-20h](../user-stories/US-FIX-20h.md) | DB config safety (fallback URL + pglite gate) | 🟠 ⚡ | — |
| [US-FIX-20i](../user-stories/US-FIX-20i.md) | Low-priority hardening bundle (rate limit, audit volume, types ฯลฯ) | 🟡 | 20a |

**ลำดับที่แนะนำ:** 20a → 20b, 20h (ขนานได้) → 20c → 20d, 20e, 20f → 20g → 20i
เหตุผล: ทุกอย่างทดสอบไม่ได้จนกว่า build จะผ่าน (20a) ส่วน 20b/20h เป็นความปลอดภัยที่ไม่ขึ้นกับใคร แก้ขนานได้ทันที

**ก่อน merge เข้า main:** รัน `npx tsc --noEmit`, `npm run lint`, `npm run build`, unit tests และทำตาม flow `/safe-deploy` เพราะมี schema change

---

## 4. หมายเหตุการทดสอบ

- Unit test ของ game engine (`src/lib/games/ox.test.ts`) รันผ่านแล้ว 5/5 (vitest)
- ยังไม่มี integration test ของ battle routes — ควรเพิ่มหลัง 20a (ใช้ local DB ตาม `/db-local`, ห้ามแตะ prod)
- Feature นี้ยังไม่เคยถูกทดสอบ end-to-end ร่วมกับระบบอื่น (ผู้พัฒนาไม่มีสิทธิ deploy) — หลังแก้ 20a ให้ทดสอบบน local ก่อนตาม `run-local.ps1`
