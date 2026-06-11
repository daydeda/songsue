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

    // Fast path: is there any ended event whose winner bonus hasn't been awarded?
    // `winnerAwardedAt` is the ONLY signal for "already processed" — we must not
    // infer it from score_history, because mid-event individual-score, milestone,
    // and manual-adjustment rows also carry this eventId and would falsely mark the
    // event as done, silently skipping the house winner bonus.
    const pending = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          lte(events.endTime, now),
          sql`${events.winnerAwardedAt} IS NULL`
        )
      )
      .limit(1);

    if (pending.length === 0) return; // nothing to award — cheap exit

    // Work exists: serialise across instances with a non-blocking advisory lock.
    await db.transaction(async (tx) => {
      // Cap how long any statement here waits on a row lock, so a concurrent
      // check-in write can't make the award block. We deliberately do NOT set
      // statement_timeout: over the Supabase transaction pooler that GUC can bleed
      // onto a reused backend and cancel unrelated queries (it was the only thing
      // in the codebase that could produce the 57014 statement-timeout errors).
      // Runaway duration is instead bounded by the award endpoint's maxDuration.
      await tx.execute(sql`SET LOCAL lock_timeout = '4000ms'`);

      const lockResult = await tx.execute<{ locked: unknown }>(
        sql`SELECT pg_try_advisory_xact_lock(${AWARD_LOCK_KEY}) AS locked`
      );
      const raw = lockResult[0]?.locked;
      const locked = raw === true || raw === "t" || raw === "true";
      if (!locked) return; // another instance is already processing these events

      // Re-fetch inside the lock so two racing callers can't both process an event.
      const pastEvents = await tx.query.events.findMany({
        where: and(lte(events.endTime, now), sql`${events.winnerAwardedAt} IS NULL`),
      });

      for (const event of pastEvents) {
        if (event.winnerAwardedAt) continue; // already processed

        const attendees = await tx.query.attendance.findMany({
          where: and(
            eq(attendance.eventId, event.id),
            eq(attendance.status, "attended")
          ),
          with: { user: { columns: { houseId: true } } },
        });

        const dbHouses = await tx.query.houses.findMany();

        if (attendees.length === 0) {
          // No attendees — record a 0-point row for the activity feed, then mark processed.
          if (dbHouses.length > 0) {
            await tx.insert(scoreHistory).values({
              houseId: dbHouses[0].id,
              eventId: event.id,
              delta: 0,
              reason: `Event "${event.title}" ended with no attendees. No points awarded.`,
            });
          }
          await tx.update(events).set({ winnerAwardedAt: new Date() }).where(eq(events.id, event.id));
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
          // All attendees unassigned — record a 0-point row, then mark processed.
          if (dbHouses.length > 0) {
            await tx.insert(scoreHistory).values({
              houseId: dbHouses[0].id,
              eventId: event.id,
              delta: 0,
              reason: `Event "${event.title}" ended but all checked-in students were unassigned. No points awarded.`,
            });
          }
          await tx.update(events).set({ winnerAwardedAt: new Date() }).where(eq(events.id, event.id));
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

        // Mark processed so this event's winner bonus is never awarded twice.
        await tx.update(events).set({ winnerAwardedAt: new Date() }).where(eq(events.id, event.id));
      }
    });
  } catch (error) {
    console.error("Failed to automatically check and award past event points:", error);
  }
}
