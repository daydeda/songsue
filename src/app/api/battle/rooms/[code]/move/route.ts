import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureGameTables } from "@/db/ensure-tables";
import { validateMove, applyMove, checkResult, OXState } from "@/lib/games/ox";
import { finalizeGameInDb } from "@/lib/games/stats-helper";
import { getClientIp, AuditService } from "@/modules/audit/audit.service";
import { captureException } from "@/lib/logger";

// POST /api/battle/rooms/[code]/move - Submit a move
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
    const userId = session.user.id;

    const body = await req.json().catch(() => ({}));
    const cell = Number(body.cell);

    if (isNaN(cell) || cell < 1 || cell > 9) {
      return NextResponse.json({ error: "Invalid move cell (must be 1-9)" }, { status: 400 });
    }

    const room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostId !== userId && room.guestId !== userId) {
      return NextResponse.json({ error: "Unauthorized to access this room" }, { status: 403 });
    }

    const now = new Date();

    // 1. Lazy evaluation of turn timeout forfeit
    if (room.status === "active" && room.turnDeadline && room.turnDeadline < now) {
      const winnerId = room.currentTurn === 1 ? (room.guestId || null) : room.hostId;
      if (winnerId) {
        await db.transaction(async (tx) => {
          await finalizeGameInDb(tx, room, winnerId, "forfeit");
        });
      }
      return NextResponse.json({ error: "Turn timed out, game finished" }, { status: 400 });
    }

    if (room.status !== "active") {
      return NextResponse.json({ error: "Game is not active" }, { status: 400 });
    }

    // 2. Validate current turn
    const expectedUser = room.currentTurn === 1 ? room.hostId : room.guestId;
    if (expectedUser !== userId) {
      return NextResponse.json({ error: "Not your turn" }, { status: 400 });
    }

    const state = room.gameState as OXState;
    const playerTurn = room.currentTurn as 1 | 2;

    // 3. Validate move legality
    if (!validateMove(state, { cell: cell as any }, playerTurn)) {
      return NextResponse.json({ error: "Illegal move" }, { status: 400 });
    }

    // 4. Apply move
    const nextState = applyMove(state, { cell: cell as any }, playerTurn);
    const gameCheck = checkResult(nextState);

    if (gameCheck.status === "win" || gameCheck.status === "draw") {
      const winnerId = gameCheck.status === "win" 
        ? (gameCheck.winner === 1 ? room.hostId : room.guestId) 
        : null;
      
      const reason = gameCheck.status === "win" ? "win" : "draw";

      await db.transaction(async (tx) => {
        // Save final state of board
        await tx.update(gameRooms)
          .set({ gameState: nextState })
          .where(eq(gameRooms.id, room.id));

        // Finalize match and update stats
        await finalizeGameInDb(tx, room, winnerId, reason);
      });

      const ip = getClientIp(req);
      await AuditService.logAction({
        actorId: userId,
        action: `Finished OX game room ${roomCode} with status ${gameCheck.status}`,
        ipAddress: ip,
      });

    } else {
      // Ongoing: switch turn, renew deadline
      const nextTurn = room.currentTurn === 1 ? 2 : 1;
      const turnDeadline = new Date(Date.now() + 60 * 1000); // 60s

      await db.update(gameRooms)
        .set({
          gameState: nextState,
          currentTurn: nextTurn,
          turnDeadline,
          updatedAt: new Date(),
        })
        .where(eq(gameRooms.id, room.id));
    }

    // Return fresh state
    const freshRoom = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.id, room.id),
      with: {
        host: {
          columns: { id: true, name: true, nickname: true, houseId: true }
        },
        guest: {
          columns: { id: true, name: true, nickname: true, houseId: true }
        }
      }
    });

    return NextResponse.json({
      roomId: freshRoom?.id,
      roomCode: freshRoom?.roomCode,
      status: freshRoom?.status,
      gameState: freshRoom?.gameState,
      currentTurn: freshRoom?.currentTurn,
      winnerId: freshRoom?.winnerId,
      finishReason: freshRoom?.finishReason,
      turnDeadline: freshRoom?.turnDeadline,
      host: freshRoom?.host,
      guest: freshRoom?.guest,
    });

  } catch (error) {
    captureException(error, { route: "POST /api/battle/rooms/[code]/move" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
