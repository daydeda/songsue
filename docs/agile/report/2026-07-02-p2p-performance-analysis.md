# รายงานวิเคราะห์ Performance ของ P2P Battle (2026-07-02)

**ที่มา:** ผู้ใช้ทดสอบเล่นจริงแล้วรู้สึกว่า "ระบบค่อนข้างช้า" — รายงานนี้ไล่ timeline ของ flow ทั้งหมดจากโค้ดจริง ระบุคอขวดพร้อมตัวเลข และเป็นฐานของ Epic **US-PERF-21** (stories 21a–21e)

**ขอบเขต:** `src/app/battle/**` (client), `src/app/api/battle/**` (server) บน branch `report` ณ วันที่วิเคราะห์ (หลังปิด US-FIX-20i แล้ว)

---

## 1. Timeline ปัจจุบัน: จากกด Join จนได้เล่น

ค่า interval ที่เกี่ยวข้อง (จาก `RoomClient.tsx`):
- **State poll** (`GET /state`): ทุก 5 วิ ในโหมด polling / ทุก 30 วิ เมื่อ WebRTC ต่อสำเร็จ — และยิงทันที 1 ครั้งเมื่อ dependency ของ effect เปลี่ยน
- **Signal poll** (`GET /signal`): ทุก 1 วิ ระหว่าง handshake, หยุดเมื่อ data channel เปิด

| ขั้น | กลไก | เวลาแย่สุด | เวลาเฉลี่ย |
|---|---|---|---|
| 1. Guest กด join → server เปลี่ยนห้องเป็น `connecting` | `POST /join` | ~0.3 วิ | ~0.3 วิ |
| 2. **Host รู้ว่ามีคนเข้าห้อง** (waiting → connecting) | state poll ของ host | **5 วิ** | 2.5 วิ |
| 3. Host ส่ง SDP offer | POST ทันทีตอน setup | ~0.3 วิ | ~0.3 วิ |
| 4. Guest ได้ offer + ส่ง answer | signal poll 1 วิ | 1.3 วิ | ~0.8 วิ |
| 5. Host ได้ answer | signal poll 1 วิ | 1.3 วิ | ~0.8 วิ |
| 6. แลก ICE candidates จน ICE สำเร็จ | signal poll 1 วิ/รอบ | 2–4 วิ | ~2 วิ |
| 7. `markRoomActive` → ทั้งคู่เห็นสถานะ `active` | dc.onopen + poll ทันทีเมื่อ connType เปลี่ยน | ~1 วิ | ~0.5 วิ |
| **รวม (WebRTC สำเร็จ)** | | **~11 วิ** | **~7 วิ** |

### กรณี WebRTC ล้มเหลว (NAT/firewall บล็อก STUN) — 🔴 ร้ายแรงที่สุด
- UI หน้า connecting เขียนว่า *"หากใช้เวลาเชื่อมต่อเกิน 10 วินาที ระบบจะสลับไปเป็นโหมด HTTP Polling อัตโนมัติ"* — **โค้ดไม่มี timer นี้อยู่จริง** (grep `setTimeout` ใน `RoomClient.tsx` มีแต่ deferred setup)
- `markRoomActive()` ถูกเรียกจาก 2 จุดเท่านั้น: `pc.onconnectionstatechange === "connected"` และ `dc.onopen` — **ถ้า WebRTC ไม่สำเร็จ จะไม่มีใครเรียก `POST /active` เลย**
- Browser อาจอยู่ในสถานะ `checking` นาน 15–40 วิ ก่อนยิง `failed` และแม้ `failed` แล้ว โค้ด fallback เป็น polling เฉยๆ แต่**ห้องยังค้างสถานะ `connecting`** → กระดานไม่ขึ้น → ผู้เล่นติดหน้า "กำลังตั้งค่าการเชื่อมต่อ" จนห้องหมดอายุ (10 นาที)
- **นี่คือ bug ที่ทำให้ "ช้า" กลายเป็น "เล่นไม่ได้"** ในเครือข่ายที่ P2P ไม่ผ่าน

## 2. Latency ระหว่างเล่น (โหมด fallback polling)

- ฝั่งที่รอ เห็นหมากคู่แข่งช้าสุด **5 วิ** เฉลี่ย 2.5 วิ ต่อตา (state poll 5 วิ — กำหนดโดย US-FIX-20g AC-3)
- `turnDeadline` sync ผ่าน poll เดียวกัน → นาฬิกานับถอยหลังกระตุกตามรอบ poll
- ฝั่งที่เดินเอง sync ทันทีจาก response ของ `POST /move` (ตรงนี้ดีอยู่แล้ว)
- โหมด WebRTC ไม่มีปัญหานี้ (data channel ส่ง move + sync ทันที)

## 3. งานฝั่ง server ต่อ request ที่เกินจำเป็น

| Route | ปัจจุบัน | ส่วนเกิน |
|---|---|---|
| `GET /state` | `findFirst` + join `host` + join `guest` **ทุก poll** | ข้อมูล host/guest เปลี่ยนแค่ครั้งเดียว (ตอน guest เข้า) แต่ join ทุก 5 วิตลอดเกม |
| `POST /move` | update แล้ว **query `freshRoom` + 2 joins ซ้ำ** เพื่อประกอบ response | `.returning()` มีข้อมูลครบแล้ว และ client ไม่ได้ใช้ `host`/`guest` จาก response นี้เลย |
| `GET /signal` | 2 queries/poll (room + opponent signal) แต่**ไม่ส่ง `room.status` กลับ** ทั้งที่มี row อยู่ในมือ | เสียโอกาส piggyback สถานะห้องบน channel ที่ poll ถี่ 1 วิอยู่แล้ว → client ต้องรอ state poll 5 วิแทน |

## 4. สรุปคอขวด → Stories

| # | คอขวด | ผลกระทบ | Story |
|---|---|---|---|
| P1 | ไม่มี WebRTC timeout + fallback ไม่ mark active → เกมไม่เริ่มเมื่อ P2P ล้มเหลว | ติดหน้า connecting ไม่จำกัดเวลา | [US-PERF-21a](../user-stories/US-PERF-21a.md) 🔴 |
| P2 | Host รอ 5 วิกว่าจะรู้ว่า guest เข้า + สถานะ active มาช้าตามรอบ poll | join→กระดาน ~7–11 วิ | [US-PERF-21b](../user-stories/US-PERF-21b.md) 🔴 |
| P3 | Handshake เสียเวลารอ tick ของ signal poll หลายรอบ | +2–3 วิ ใน handshake | [US-PERF-21c](../user-stories/US-PERF-21c.md) 🟠 |
| P4 | เดินหมาก fallback ช้าสุด 5 วิ/ตา | เกมหน่วงเมื่อ P2P ไม่ผ่าน | [US-PERF-21d](../user-stories/US-PERF-21d.md) 🟠 |
| P5 | Query เกินจำเป็นใน /state, /move, /signal | ต้นทุน DB ต่อ poll สูงเกินเหตุ | [US-PERF-21e](../user-stories/US-PERF-21e.md) 🟠 |

**เป้าหมายรวมของ epic:** join→เห็นกระดาน ≤ 4 วิ (WebRTC สำเร็จ) / ≤ 12 วิ (fallback, มีเพดานแน่นอน), หมากคู่แข่งแสดงผล ≤ 2.5 วิในโหมด fallback, จำนวน DB query ต่อ poll ลดลง โดยรวม request budget ไม่แย่กว่ากติกา free-tier เดิมของ US-FIX-20g

## 5. นอกขอบเขต (บันทึกไว้พิจารณาภายหลัง)
- **TURN server** (เช่น coturn บน Docker self-hosted) — แก้รากของ WebRTC ล้มเหลวหลัง NAT แบบเข้มงวด แต่มีต้นทุน bandwidth/ops; ควรเก็บสถิติอัตราสำเร็จของ P2P ก่อนตัดสินใจ
- WebSocket/SSE signaling แทน polling — เปลี่ยนสถาปัตยกรรมใหญ่ ไม่คุ้มตราบใดที่ handshake จบใน ~2 วิด้วย polling ที่จูนแล้ว
