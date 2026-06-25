import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureGameTables } from "@/db/ensure-tables";
import { finalizeGameInDb } from "@/lib/games/stats-helper";
import { captureException } from "@/lib/logger";

// GET /api/battle/rooms/[code]/state - Get current game/board state + lazy evaluations
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await ensureGameTables();

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const roomCode = code.toUpperCase();
    const userId = session.user.id;

    let room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
      with: {
        host: {
          columns: { id: true, name: true, nickname: true, houseId: true }
        },
        guest: {
          columns: { id: true, name: true, nickname: true, houseId: true }
        }
      }
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostId !== userId && room.guestId !== userId) {
      return NextResponse.json({ error: "Unauthorized to access this room" }, { status: 403 });
    }

    const now = new Date();

    // 1. Lazy evaluation of waiting room expiration
    if (room.status === "waiting" && room.expiresAt < now) {
      await db.update(gameRooms)
        .set({ status: "expired", updatedAt: now })
        .where(eq(gameRooms.id, room.id));
      room.status = "expired";
    }

    // 2. Lazy evaluation of turn timeout forfeit
    if (room.status === "active" && room.turnDeadline && room.turnDeadline < now) {
      const winnerId = room.currentTurn === 1 ? room.guestId : room.hostId;

      if (winnerId) {
        await db.transaction(async (tx) => {
          await finalizeGameInDb(tx, room, winnerId, "forfeit");
        });

        room.status = "finished";
        room.winnerId = winnerId;
        room.finishReason = "forfeit";
      }
    }

    return NextResponse.json({
      roomId: room.id,
      roomCode: room.roomCode,
      gameType: room.gameType,
      status: room.status,
      hostId: room.hostId,
      guestId: room.guestId,
      gameState: room.gameState,
      currentTurn: room.currentTurn,
      winnerId: room.winnerId,
      finishReason: room.finishReason,
      turnDeadline: room.turnDeadline,
      host: room.host,
      guest: room.guest,
    });

  } catch (error) {
    captureException(error, { route: "GET /api/battle/rooms/[code]/state" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
