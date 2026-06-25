import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureGameTables } from "@/db/ensure-tables";
import { createInitialState } from "@/lib/games/ox";
import { getClientIp, AuditService } from "@/modules/audit/audit.service";
import { captureException } from "@/lib/logger";

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// POST /api/battle/rooms - Create a new room
export async function POST(req: Request) {
  try {
    await ensureGameTables();

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hostId = session.user.id;

    // Verify host user exists in database (handles stale session cookies after database resets)
    const hostExists = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, hostId),
      columns: { id: true }
    });
    if (!hostExists) {
      return NextResponse.json({ error: "User not found in database. Please log out and sign in again." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const gameType = body.gameType || "ox";

    if (gameType !== "ox") {
      return NextResponse.json({ error: "Unsupported game type" }, { status: 400 });
    }

    // Generate unique room code
    let roomCode = "";
    let attempts = 0;
    while (attempts < 10) {
      roomCode = generateRoomCode();
      const existing = await db.query.gameRooms.findFirst({
        where: (r, { eq, and, gt }) => and(
          eq(r.roomCode, roomCode),
          gt(r.expiresAt, new Date()),
          eq(r.status, "waiting")
        )
      });
      if (!existing) break;
      attempts++;
    }

    if (!roomCode) {
      return NextResponse.json({ error: "Failed to generate room code" }, { status: 500 });
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const initialState = createInitialState();

    const [newRoom] = await db.insert(gameRooms).values({
      roomCode,
      gameType,
      hostId,
      gameState: initialState,
      status: "waiting",
      currentTurn: 1, // Host is player 1
      expiresAt,
    }).returning();

    const ip = getClientIp(req);
    await AuditService.logAction({
      actorId: hostId,
      action: `Created P2P game room ${roomCode} (${gameType})`,
      ipAddress: ip,
    });

    return NextResponse.json({
      roomId: newRoom.id,
      roomCode: newRoom.roomCode,
      gameType: newRoom.gameType,
      expiresAt: newRoom.expiresAt,
      status: newRoom.status,
    });

  } catch (error) {
    captureException(error, { route: "POST /api/battle/rooms" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
