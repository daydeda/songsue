import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { captureException } from "@/lib/logger";

// GET /api/battle/stats/me - Retrieve my OX stats and match history
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch stats
    let stats = await db.query.gameStats.findFirst({
      where: (gs, { eq, and }) => and(eq(gs.userId, userId), eq(gs.gameType, "ox")),
    });

    if (!stats) {
      stats = {
        id: "",
        userId,
        gameType: "ox",
        wins: 0,
        losses: 0,
        draws: 0,
        winStreak: 0,
        bestStreak: 0,
        totalGames: 0,
        lastPlayedAt: new Date(),
      };
    }

    // Fetch match history (last 10 games)
    const history = await db.query.gameRooms.findMany({
      where: (r, { eq, or, and }) => and(
        eq(r.status, "finished"),
        or(eq(r.hostId, userId), eq(r.guestId, userId))
      ),
      orderBy: desc(gameRooms.updatedAt),
      limit: 10,
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
      stats,
      history,
    });

  } catch (error) {
    captureException(error, { route: "GET /api/battle/stats/me" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
