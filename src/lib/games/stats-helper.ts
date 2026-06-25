import { db } from "@/db";
import { gameRooms, gameStats } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function updatePlayerStats(tx: any, userId: string, result: 'win' | 'loss' | 'draw') {
  const existing = await tx.query.gameStats.findFirst({
    where: and(eq(gameStats.userId, userId), eq(gameStats.gameType, 'ox')),
  });

  if (existing) {
    const wins = result === 'win' ? existing.wins + 1 : existing.wins;
    const losses = result === 'loss' ? existing.losses + 1 : existing.losses;
    const draws = result === 'draw' ? existing.draws + 1 : existing.draws;
    const totalGames = existing.totalGames + 1;
    const winStreak = result === 'win' ? existing.winStreak + 1 : (result === 'loss' ? 0 : existing.winStreak);
    const bestStreak = Math.max(existing.bestStreak, winStreak);

    await tx.update(gameStats)
      .set({
        wins,
        losses,
        draws,
        totalGames,
        winStreak,
        bestStreak,
        lastPlayedAt: new Date(),
      })
      .where(eq(gameStats.id, existing.id));
  } else {
    const wins = result === 'win' ? 1 : 0;
    const losses = result === 'loss' ? 1 : 0;
    const draws = result === 'draw' ? 1 : 0;
    const winStreak = result === 'win' ? 1 : 0;
    
    await tx.insert(gameStats).values({
      userId,
      gameType: 'ox',
      wins,
      losses,
      draws,
      totalGames: 1,
      winStreak,
      bestStreak: winStreak,
      lastPlayedAt: new Date(),
    });
  }
}

export async function finalizeGameInDb(
  tx: any,
  room: { id: string; hostId: string; guestId: string | null },
  winnerId: string | null,
  reason: string
) {
  // 1. Update room
  await tx.update(gameRooms)
    .set({
      status: "finished",
      winnerId,
      finishReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(gameRooms.id, room.id));

  // 2. Update stats
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
}
