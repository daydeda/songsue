import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureGameTables } from "@/db/ensure-tables";
import { captureException } from "@/lib/logger";

// GET /api/battle/rooms/[code] - Inspect room status
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

    const room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
      with: {
        host: {
          columns: {
            id: true,
            name: true,
            nickname: true,
            houseId: true,
          }
        },
        guest: {
          columns: {
            id: true,
            name: true,
            nickname: true,
            houseId: true,
          }
        }
      }
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Lazy evaluation for room expiration
    if (room.status === "waiting" && room.expiresAt < new Date()) {
      await db.update(gameRooms)
        .set({ status: "expired" })
        .where(eq(gameRooms.id, room.id));
      room.status = "expired";
    }

    return NextResponse.json({
      roomId: room.id,
      roomCode: room.roomCode,
      gameType: room.gameType,
      status: room.status,
      host: room.host,
      guest: room.guest,
      currentTurn: room.currentTurn,
      expiresAt: room.expiresAt,
    });

  } catch (error) {
    captureException(error, { route: "GET /api/battle/rooms/[code]" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
