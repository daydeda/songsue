import { db } from "@/db";
import { events, attendance, scoreHistory, houses, forms } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";

// Arbitrary constant key for the Postgres advisory lock that serialises award
// runs across all serverless instances. Any fixed integer works.
const AWARD_LOCK_KEY = 728193;
// A distinct lock key for the form-contest award run, so it can proceed
// independently of the event-winner run without the two blocking each other.
const FORM_AWARD_LOCK_KEY = 728194;

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
          // No attendees — mark processed and move on. We deliberately do NOT write a
          // score_history row here: attributing it to dbHouses[0] tied an event nobody
          // attended to an arbitrary house and surfaced it in that house's activity
          // feed. An event with zero attendance belongs to no house.
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
          // Everyone who checked in is unassigned to a house — no house participated,
          // so mark processed without writing a score_history row (same reasoning as
          // the no-attendees case above: don't attribute it to an arbitrary house).
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

        // No points configured for this event (e.g. a survey/sign-up) → nothing
        // actually moves, so there's no real award. Mark processed and skip without
        // writing a 0-point "winner" row that would clutter a house's activity feed.
        if (pointsToAward <= 0) {
          await tx.update(events).set({ winnerAwardedAt: new Date() }).where(eq(events.id, event.id));
          continue;
        }

        for (const [winnerHouseId, data] of winners) {
          await tx
            .update(houses)
            .set({ points: sql`${houses.points} + ${pointsToAward}` })
            .where(eq(houses.id, winnerHouseId));

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

/**
 * Awards each evaluation form's contest points to the house that completed it the
 * most, as soon as the form's scheduled `closesAt` has passed. This replaces the
 * old manual "End & Award Points" button — there is no manual open/close anymore,
 * the schedule window alone drives the form lifecycle.
 *
 * Same cheap-by-default shape as checkAndAwardPastEventPoints:
 *
 *  - Fast path: one tiny query asks "is any form past closesAt and not yet
 *    awarded?". The forms table is small, so in steady state this returns nothing
 *    and we exit immediately — no transaction, no lock. Safe to call on hot reads.
 *
 *  - When a form has just closed, ONE transaction takes a transaction-scoped
 *    advisory lock (distinct key from the event run) so only one instance does the
 *    work. The `is_awarded = false` WHERE on the flip is the atomic gate: the
 *    loser of a race updates 0 rows and skips, so points can never be awarded twice.
 *
 * Never throws — failures are logged and swallowed so callers can fire it safely.
 */
export async function checkAndAwardClosedForms() {
  try {
    const now = new Date();

    // Fast path: any scheduled-closed form still awaiting its contest award?
    const pending = await db
      .select({ id: forms.id })
      .from(forms)
      .where(
        and(
          sql`${forms.closesAt} IS NOT NULL`,
          lte(forms.closesAt, now),
          eq(forms.isAwarded, false)
        )
      )
      .limit(1);

    if (pending.length === 0) return; // nothing to award — cheap exit

    await db.transaction(async (tx) => {
      // Bound row-lock waits without using statement_timeout (see the note in
      // checkAndAwardPastEventPoints for why statement_timeout is avoided here).
      await tx.execute(sql`SET LOCAL lock_timeout = '4000ms'`);

      const lockResult = await tx.execute<{ locked: unknown }>(
        sql`SELECT pg_try_advisory_xact_lock(${FORM_AWARD_LOCK_KEY}) AS locked`
      );
      const raw = lockResult[0]?.locked;
      const locked = raw === true || raw === "t" || raw === "true";
      if (!locked) return; // another instance is already processing closed forms

      // Re-fetch inside the lock, with the submissions + each submitter's house.
      const closedForms = await tx.query.forms.findMany({
        where: and(
          sql`${forms.closesAt} IS NOT NULL`,
          lte(forms.closesAt, now),
          eq(forms.isAwarded, false)
        ),
        with: {
          submissions: {
            with: { user: { columns: { houseId: true } } },
          },
        },
      });

      const dbHouses = await tx.query.houses.findMany();
      const houseNameMap = new Map(dbHouses.map((h) => [h.id, h.name]));

      for (const formObj of closedForms) {
        // Atomic gate: flip is_awarded only if still false. Also closes the form
        // (is_active=false) for tidiness. A racing run updates 0 rows and skips.
        const flipped = await tx
          .update(forms)
          .set({ isActive: false, isAwarded: true, updatedAt: new Date() })
          .where(and(eq(forms.id, formObj.id), eq(forms.isAwarded, false)))
          .returning({ id: forms.id });

        if (flipped.length === 0) continue; // someone else already awarded it

        // Count submissions per house (the contest metric: most completions wins).
        const houseCounts: Record<string, number> = {};
        for (const sub of formObj.submissions) {
          const houseId = sub.user?.houseId;
          if (!houseId) continue;
          houseCounts[houseId] = (houseCounts[houseId] || 0) + 1;
        }

        const houseList = Object.entries(houseCounts);
        if (houseList.length === 0) continue; // closed with no eligible submissions

        const pointsToAward = formObj.pointsAwarded ?? 0;
        // No points configured for this form/survey → no real award; don't write a
        // 0-point contest row that would surface the form under a house's feed. The
        // form is already flagged is_awarded above, so it stays processed.
        if (pointsToAward <= 0) continue;

        let maxSubmissions = -1;
        for (const [, count] of houseList) {
          if (count > maxSubmissions) maxSubmissions = count;
        }
        const winningHouseIds = houseList
          .filter(([, count]) => count === maxSubmissions)
          .map(([hId]) => hId);

        for (const winnerId of winningHouseIds) {
          const houseName = houseNameMap.get(winnerId) || winnerId;

          await tx
            .update(houses)
            .set({ points: sql`${houses.points} + ${pointsToAward}` })
            .where(eq(houses.id, winnerId));

          const reasonStr =
            winningHouseIds.length > 1
              ? `Event Form Contest Tie Winner: ${houseName} House completed the evaluation form "${formObj.title}" most with ${maxSubmissions} submissions! Shared ${pointsToAward} PTS.`
              : `Event Form Contest Winner: ${houseName} House completed the evaluation form "${formObj.title}" most with ${maxSubmissions} submissions! Received ${pointsToAward} PTS.`;

          await tx.insert(scoreHistory).values({
            houseId: winnerId,
            eventId: formObj.eventId,
            delta: pointsToAward,
            reason: reasonStr,
            timestamp: new Date(),
          });
        }
      }
    });
  } catch (error) {
    console.error("Failed to automatically check and award closed form points:", error);
  }
}
