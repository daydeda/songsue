import { db } from "@/db";
import { events, attendance, scoreHistory, houses } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";

// Arbitrary constant key for the Postgres advisory lock that serialises award
// runs across all serverless instances. Any fixed integer works.
const AWARD_LOCK_KEY = 728193;

/**
 * Awards the event-winner bonus to the house with the most attendees for every
 * event that has ended and not yet been processed.
 *
 * Safe to call frequently (e.g. on each admin dashboard poll):
 *
 *  - Fast path: a single indexed query checks whether any ended event still lacks
 *    a score_history row. In steady state this returns nothing and we exit
 *    immediately — no transaction, no locks, negligible cost.
 *
 *  - When an event has just ended, we open ONE transaction and grab a
 *    transaction-scoped advisory lock. Only one instance can hold it at a time, so
 *    concurrent callers skip instantly instead of fighting over the `houses` rows
 *    (the old behaviour deadlocked under `max: 1`). The lock releases automatically
 *    when the transaction commits.
 *
 * Never throws — failures are logged and swallowed so callers can fire it safely.
 */
export async function checkAndAwardPastEventPoints() {
  try {
    const now = new Date();

    // Fast path: is there any ended event with no score_history row yet?
    // "has a score_history row" is the existing definition of "already processed".
    const pending = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          lte(events.endTime, now),
          sql`NOT EXISTS (SELECT 1 FROM ${scoreHistory} WHERE ${scoreHistory.eventId} = ${events.id})`
        )
      )
      .limit(1);

    if (pending.length === 0) return; // nothing to award — cheap exit

    // Work exists: serialise across instances with a non-blocking advisory lock.
    await db.transaction(async (tx) => {
      // Hard safety rails: this transaction must NEVER hold a pooled DB connection
      // for long. lock_timeout caps how long any statement waits on a row lock;
      // statement_timeout caps total per-statement runtime. If either trips, the
      // statement errors, the transaction rolls back, the advisory lock and the
      // connection are released immediately, and the outer catch swallows it. This
      // is what prevents one slow award run from starving the pooler (the cause of
      // the site-wide 504s).
      await tx.execute(sql`SET LOCAL lock_timeout = '4000ms'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '8000ms'`);

      const lockResult = await tx.execute<{ locked: unknown }>(
        sql`SELECT pg_try_advisory_xact_lock(${AWARD_LOCK_KEY}) AS locked`
      );
      const raw = lockResult[0]?.locked;
      const locked = raw === true || raw === "t" || raw === "true";
      if (!locked) return; // another instance is already processing these events

      // Re-fetch inside the lock so two racing callers can't both process an event.
      const pastEvents = await tx.query.events.findMany({
        where: lte(events.endTime, now),
      });

      for (const event of pastEvents) {
        const existingAward = await tx.query.scoreHistory.findFirst({
          where: eq(scoreHistory.eventId, event.id),
        });
        if (existingAward) continue; // already processed

        const attendees = await tx.query.attendance.findMany({
          where: and(
            eq(attendance.eventId, event.id),
            eq(attendance.status, "attended")
          ),
          with: { user: { columns: { houseId: true } } },
        });

        const dbHouses = await tx.query.houses.findMany();

        if (attendees.length === 0) {
          // No attendees — mark processed with a 0-point row to prevent re-processing.
          if (dbHouses.length > 0) {
            await tx.insert(scoreHistory).values({
              houseId: dbHouses[0].id,
              eventId: event.id,
              delta: 0,
              reason: `Event "${event.title}" ended with no attendees. No points awarded.`,
            });
          }
          continue;
        }

        // Count attendees grouped by house.
        const houseCounts: Record<string, { count: number; name: string; color: string }> = {};
        const houseMap = new Map(dbHouses.map((h) => [h.id, h]));

        for (const att of attendees) {
          const houseId = att.user?.houseId;
          if (!houseId) continue;
          const houseObj = houseMap.get(houseId);
          if (!houseObj) continue;
          if (!houseCounts[houseId]) {
            houseCounts[houseId] = { count: 0, name: houseObj.name, color: houseObj.color ?? "" };
          }
          houseCounts[houseId].count++;
        }

        const houseList = Object.entries(houseCounts);
        if (houseList.length === 0) {
          // All attendees unassigned — mark processed.
          if (dbHouses.length > 0) {
            await tx.insert(scoreHistory).values({
              houseId: dbHouses[0].id,
              eventId: event.id,
              delta: 0,
              reason: `Event "${event.title}" ended but all checked-in students were unassigned. No points awarded.`,
            });
          }
          continue;
        }

        // Winning house(s) — supports ties.
        let maxCount = -1;
        for (const [, data] of houseList) {
          if (data.count > maxCount) maxCount = data.count;
        }
        const winners = houseList.filter(([, data]) => data.count === maxCount);
        const pointsToAward = event.pointsAwarded ?? 0;

        for (const [winnerHouseId, data] of winners) {
          if (pointsToAward > 0) {
            await tx
              .update(houses)
              .set({ points: sql`${houses.points} + ${pointsToAward}` })
              .where(eq(houses.id, winnerHouseId));
          }

          const reasonStr = winners.length > 1
            ? `Event "${event.title}" completed! TIE WINNER: ${data.name} House won with ${data.count} attendees! Shared ${pointsToAward} PTS.`
            : `Event "${event.title}" completed! WINNER: ${data.name} House won with ${data.count} attendees! Received ${pointsToAward} PTS.`;

          await tx.insert(scoreHistory).values({
            houseId: winnerHouseId,
            eventId: event.id,
            delta: pointsToAward,
            reason: reasonStr,
            timestamp: new Date(),
          });
        }
      }
    });
  } catch (error) {
    console.error("Failed to automatically check and award past event points:", error);
  }
}
