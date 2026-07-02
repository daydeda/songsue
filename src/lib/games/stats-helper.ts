import { db } from "@/db";
import { gameRooms, gameStats, webrtcSignals } from "@/db/schema";
import { eq, and, sql, lt, inArray } from "drizzle-orm";

export async function updatePlayerStats(tx: any, userId: string, result: 'win' | 'loss' | 'draw') {
  await tx.insert(gameStats)
    .values({
      userId,
      gameType: 'ox',
      wins: result === 'win' ? 1 : 0,
      losses: result === 'loss' ? 1 : 0,
      draws: result === 'draw' ? 1 : 0,
      winStreak: result === 'win' ? 1 : 0,
      bestStreak: result === 'win' ? 1 : 0,
      totalGames: 1,
      lastPlayedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [gameStats.userId, gameStats.gameType],
      set: {
        wins: result === 'win' ? sql`game_stats.wins + 1` : sql`game_stats.wins`,
        losses: result === 'loss' ? sql`game_stats.losses + 1` : sql`game_stats.losses`,
        draws: result === 'draw' ? sql`game_stats.draws + 1` : sql`game_stats.draws`,
        totalGames: sql`game_stats.total_games + 1`,
        winStreak: result === 'win'
          ? sql`game_stats.win_streak + 1`
          : (result === 'loss' ? 0 : sql`game_stats.win_streak`),
        bestStreak: result === 'win'
          ? sql`GREATEST(game_stats.best_streak, game_stats.win_streak + 1)`
          : sql`game_stats.best_streak`,
        lastPlayedAt: new Date(),
      }
    });
}

export async function finalizeGameInDb(
  tx: any,
  room: { id: string; hostId: string; guestId: string | null },
  winnerId: string | null,
  reason: string
) {
  // 1. Update room status conditionally (only if it was active) to achieve idempotency
  const updatedRooms = await tx.update(gameRooms)
    .set({
      status: "finished",
      winnerId,
      finishReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(gameRooms.id, room.id), eq(gameRooms.status, "active")))
    .returning();

  if (updatedRooms.length === 0) {
    // Already finalized by another request/poll, skip updating stats and signals
    return;
  }

  // 2. Update stats atomically
  if (winnerId) {
    const loserId = winnerId === room.hostId ? room.guestId : room.hostId;
    await updatePlayerStats(tx, winnerId, 'win');
    if (loserId) {
      await updatePlayerStats(tx, loserId, 'loss');
    }
  } else {
    // Draw
    await updatePlayerStats(tx, room.hostId, 'draw');
    if (room.guestId) {
      await updatePlayerStats(tx, room.guestId, 'draw');
    }
  }

  // 3. Delete WebRTC signals for this room (US-FIX-20f AC-3)
  await tx.delete(webrtcSignals).where(eq(webrtcSignals.roomId, room.id));
}

export async function cleanupOldGameRooms() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // 1. Delete expired or finished rooms older than 30 days
  const deletedRooms = await db.delete(gameRooms)
    .where(
      and(
        inArray(gameRooms.status, ["expired", "finished"]),
        lt(gameRooms.updatedAt, thirtyDaysAgo)
      )
    )
    .returning({ id: gameRooms.id });

  // 2. Clean up any signals for rooms that are no longer active/waiting
  const deletedSignals = await db.delete(webrtcSignals)
    .where(
      inArray(
        webrtcSignals.roomId,
        db
          .select({ id: gameRooms.id })
          .from(gameRooms)
          .where(inArray(gameRooms.status, ["expired", "finished"]))
      )
    )
    .returning({ id: webrtcSignals.id });

  return {
    deletedRoomsCount: deletedRooms.length,
    deletedSignalsCount: deletedSignals.length,
  };
}
