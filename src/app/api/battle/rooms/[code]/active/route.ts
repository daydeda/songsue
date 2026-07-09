import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { captureException } from "@/lib/logger";
import { effectiveRoles } from "@/lib/admin-access";
import { canAccessBattle } from "@/lib/battle-access";

// POST /api/battle/rooms/[code]/active - Mark room as active (WebRTC connected)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccessBattle(effectiveRoles(session.user.role, session.user.roles))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { code } = await params;
    const roomCode = code.toUpperCase();
    const userId = session.user.id;

    const room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostId !== userId && room.guestId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (room.status === "waiting" || room.status === "connecting") {
      const turnDeadline = new Date(Date.now() + 60 * 1000); // 60s
      
      await db.update(gameRooms)
        .set({
          status: "active",
          turnDeadline,
          updatedAt: new Date(),
        })
        .where(eq(gameRooms.id, room.id));

      return NextResponse.json({ success: true, status: "active", turnDeadline });
    }

    return NextResponse.json({ success: true, status: room.status });

  } catch (error) {
    captureException(error, { route: "POST /api/battle/rooms/[code]/active" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
