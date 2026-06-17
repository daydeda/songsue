import { db } from "@/db";
import { houses, scoreHistory } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";

export class HousesService {
  /**
   * Picks the house a new member should join for balanced distribution (FE-03):
   * the house with the fewest members right now. Ties resolve to the first such
   * house by query order. Shared by the onboarding profile submit and the staff
   * onboarding-bypass provisioning so both stay in lockstep.
   *
   * Returns the house id, or null if no houses exist yet (caller leaves houseId
   * unset rather than crashing).
   */
  static async pickBalancedHouseId(): Promise<string | null> {
    const housesList = await db.query.houses.findMany({
      with: { users: { columns: { id: true } } },
    });
    if (housesList.length === 0) return null;
    const sorted = [...housesList].sort((a, b) => a.users.length - b.users.length);
    return sorted[0].id;
  }

  /**
   * Adjusts house points atomically inside a database transaction,
   * inserts a record into score history, and writes an audit log.
   */
  static async adjustHousePoints(params: {
    houseId: string;
    delta: number;
    reason: string;
    actorId?: string;
    ipAddress?: string;
    eventId?: string;
  }) {
    const { houseId, delta, reason, actorId, ipAddress, eventId } = params;

    const result = await db.transaction(async (tx) => {
      // 1. Update house points atomically
      await tx
        .update(houses)
        .set({
          points: sql`${houses.points} + ${delta}`,
        })
        .where(eq(houses.id, houseId));

      // 2. Log score history
      const [historyRecord] = await tx
        .insert(scoreHistory)
        .values({
          houseId,
          delta,
          reason,
          eventId: eventId || null,
          timestamp: new Date(),
        })
        .returning();

      // 3. Write Audit Log (decoupled call to AuditService)
      if (actorId) {
        await AuditService.logActionInternal(tx, {
          actorId,
          action: `Adjusted house ${houseId} points by ${delta}. Reason: ${reason}`,
          ipAddress: ipAddress || "127.0.0.1",
        });
      }

      return { historyRecord };
    });

    return result?.historyRecord;
  }

  /**
   * Fetch leaderboard rankings
   */
  static async getLeaderboard() {
    return await db.query.houses.findMany({
      orderBy: (houses, { desc }) => [desc(houses.points)],
    });
  }

  /**
   * Fetch recent score history logs
   */
  static async getRecentActivity(limit = 50) {
    return await db.query.scoreHistory.findMany({
      orderBy: (scoreHistory, { desc }) => [desc(scoreHistory.timestamp)],
      limit,
      with: {
        house: true,
        event: true,
      },
    });
  }
}
