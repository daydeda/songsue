# OX (Tic-Tac-Toe) — Game Module Design

**Version:** 1.0 | **Last Updated:** 2026-06-24  
**Game ID:** `ox`  
**สถานะ:** v1.0 — MVP (Game Module แรกของแพลตฟอร์ม)  
**เชื่อมโยง:** [Platform Concept](../00-concept.md) | [Platform Mechanics](../01-mechanics.md)

---

## 1. ภาพรวม (Overview)

OX เป็น Game Module แรกบน ActiveCAMT P2P Battle Platform เลือกเพราะ:
- กฎง่าย — ทดสอบโครงสร้างแพลตฟอร์ม (WebRTC, Room Code, Turn system) ได้โดยตรง
- State เล็ก — board เป็นแค่ array 9 ช่อง เหมาะสำหรับส่งผ่าน DataChannel
- Win detection ง่าย — 8 pattern ตรวจได้ใน O(1)
- ทุกคนรู้จัก — ไม่ต้องอธิบายกฎ

---

## 2. Game State

```typescript
type OXBoard = [
  0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2,  // แถว 1: ช่อง 1–3
  0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2,  // แถว 2: ช่อง 4–6
  0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2   // แถว 3: ช่อง 7–9
]
// 0 = ว่าง, 1 = X (Host/Player1), 2 = O (Guest/Player2)

type OXState = {
  board: OXBoard
}
```

**State เริ่มต้น:** `[0,0,0, 0,0,0, 0,0,0]`

### การแสดงผลกระดาน

```
ช่อง:          ตัวอย่างเกม:
 1 │ 2 │ 3      X │   │ O
───┼───┼───    ───┼───┼───
 4 │ 5 │ 6        │ X │
───┼───┼───    ───┼───┼───
 7 │ 8 │ 9      O │   │
```

---

## 3. Player Actions (การกระทำของผู้เล่น)

| Action | Input | เงื่อนไข | ผลลัพธ์ |
|---|---|---|---|
| **วางหมาก** | กดช่องบนกระดาน (1–9) | เป็นเทิร์นของตน + ช่องว่าง (board[i] === 0) | board อัปเดต, สลับเทิร์น |
| **ยอมแพ้** | กดปุ่ม Resign | เกม active อยู่ | finish_reason=resign |

**Move Format (ส่งผ่าน DataChannel + Server):**
```typescript
type OXMove = {
  cell: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9  // ช่องที่ต้องการวาง
}
```

---

## 4. Win / Draw Conditions

### 4.1 Win Patterns (8 แบบ)

```typescript
const WIN_PATTERNS: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],  // แนวนอน
  [0, 3, 6], [1, 4, 7], [2, 5, 8],  // แนวตั้ง
  [0, 4, 8], [2, 4, 6],             // แนวทแยง
]

function checkWin(board: OXBoard, player: 1 | 2): boolean {
  return WIN_PATTERNS.some(([a, b, c]) =>
    board[a] === player && board[b] === player && board[c] === player
  )
}
```

### 4.2 Draw

```typescript
function checkDraw(board: OXBoard): boolean {
  return board.every(cell => cell !== 0) // กระดานเต็ม ไม่มีผู้ชนะ
}
```

### 4.3 Result Detection (implement GameModule.checkResult)

```typescript
function checkResult(state: OXState): { status: 'ongoing'|'win'|'draw', winner?: 1|2 } {
  if (checkWin(state.board, 1)) return { status: 'win', winner: 1 }
  if (checkWin(state.board, 2)) return { status: 'win', winner: 2 }
  if (checkDraw(state.board))   return { status: 'draw' }
  return { status: 'ongoing' }
}
```

---

## 5. UI / UX Mockups

### 5.1 Lobby — Host รอ Guest (แสดง QR + Code)

```
┌─────────────────────────────────┐
│  ⚔️  OX Battle — รอผู้เล่น...   │
│                                 │
│  ┌─────────────────────────┐    │
│  │  ██████████████████████ │    │
│  │  ██  QR Code ภาพใหญ่  ██ │    │
│  │  ██████████████████████ │    │
│  └─────────────────────────┘    │
│                                 │
│   หรือแชร์รหัสห้อง:             │
│   ┌─────────────────────┐       │
│   │      X  K  7  F      │       │
│   └─────────────────────┘       │
│                                 │
│   ⏳ รอผู้เล่นเข้าร่วม...      │
│   [ยกเลิกห้อง]                  │
└─────────────────────────────────┘
```

### 5.2 Join — Guest สแกน QR หรือพิมพ์รหัส

```
┌─────────────────────────────────┐
│  เข้าร่วมเกม                    │
│                                 │
│  [📷 สแกน QR Code]             │
│                                 │
│         — หรือ —                │
│                                 │
│  พิมพ์รหัสห้อง:                 │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  │ X │ │ K │ │ 7 │ │ F │       │
│  └───┘ └───┘ └───┘ └───┘       │
│                                 │
│      [เข้าร่วมเกม]               │
└─────────────────────────────────┘
```

### 5.3 Active Game — กระดาน OX

```
┌─────────────────────────────────┐
│  vs SomchaiK                    │
│  ✕ คุณ (X)  │  ○ SomchaiK (O) │
│                                 │
│  ⏱ เทิร์นของคุณ — 42s          │
│                                 │
│  ┌───────┬───────┬───────┐      │
│  │       │       │   O   │      │
│  │       │       │       │      │
│  ├───────┼───────┼───────┤      │
│  │       │   X   │       │      │
│  │       │       │       │      │
│  ├───────┼───────┼───────┤      │
│  │   O   │       │       │      │
│  │       │       │       │      │
│  └───────┴───────┴───────┘      │
│   (กดช่องที่ต้องการวางหมาก)      │
│                                 │
│              [ยอมแพ้]            │
└─────────────────────────────────┘
```

### 5.4 Result Screen

```
┌─────────────────────────────────┐
│                                 │
│        🎉  คุณชนะ!              │
│   (หรือ 😔 คุณแพ้ / 🤝 เสมอ)  │
│                                 │
│   vs SomchaiK                   │
│   ชนะด้วยแนวทแยง ↘             │
│                                 │
│   ┌───┬───┬───┐                 │
│   │✕* │   │ O │                 │
│   ├───┼───┼───┤                 │
│   │   │✕* │   │                 │
│   ├───┼───┼───┤                 │
│   │ O │   │✕* │  (* winning)    │
│   └───┴───┴───┘                 │
│                                 │
│   W: 14  L: 5  D: 2            │
│   🔥 Win Streak: 4              │
│                                 │
│  [กลับ Hub]     [Rematch]       │
└─────────────────────────────────┘
```

---

## 6. Edge Cases (เฉพาะ OX)

| กรณี | การจัดการ |
|---|---|
| วางช่องที่มีหมากแล้ว | Server return HTTP 400 — client ไม่อัปเดต board |
| ส่ง cell ออกนอก 1–9 | Server return HTTP 400 (Zod validation) |
| DataChannel ส่ง move แล้ว server ปฏิเสธ | Client rollback visual แสดงสถานะก่อนหน้า, ดึง state จาก server |

---

## เอกสารที่เกี่ยวข้อง

- Platform Concept: [Platform Concept](../00-concept.md)
- Platform Mechanics: [Platform Mechanics](../01-mechanics.md)
- Backlog: [Product Backlog](../../agile/01-product-backlog.md)
