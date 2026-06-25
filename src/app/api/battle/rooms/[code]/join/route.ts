import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureGameTables } from "@/db/ensure-tables";
import { getClientIp, AuditService } from "@/modules/audit/audit.service";
import { captureException } from "@/lib/logger";

// POST /api/battle/rooms/[code]/join - Guest joins a room
export async function POST(
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
    const guestId = session.user.id;

    const room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status === "waiting" && room.expiresAt < new Date()) {
      await db.update(gameRooms)
        .set({ status: "expired" })
        .where(eq(gameRooms.id, room.id));
      return NextResponse.json({ error: "Room has expired" }, { status: 400 });
    }

    if (room.status !== "waiting") {
      return NextResponse.json({ error: "Room is not joinable" }, { status: 400 });
    }

    if (room.hostId === guestId) {
      return NextResponse.json({ error: "You cannot join your own room" }, { status: 400 });
    }

    await db.update(gameRooms)
      .set({
        guestId,
        status: "connecting",
        updatedAt: new Date(),
      })
      .where(eq(gameRooms.id, room.id));

    const ip = getClientIp(req);
    await AuditService.logAction({
      actorId: guestId,
      action: `Joined P2P game room ${roomCode} as guest`,
      ipAddress: ip,
    });

    return NextResponse.json({
      roomId: room.id,
      roomCode: room.roomCode,
      gameType: room.gameType,
      status: "connecting",
      hostId: room.hostId,
      guestId,
    });

  } catch (error) {
    captureException(error, { route: "POST /api/battle/rooms/[code]/join" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
