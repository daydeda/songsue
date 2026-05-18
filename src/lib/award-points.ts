import { db } from "@/db";
import { events, attendance, scoreHistory, houses } from "@/db/schema";
import { eq, and, lte, sql } from "drizzle-orm";

/**
 * Automatically checks all ended (past) events, calculates the house with the most attendees,
 * awards the event points to the winning house(s), and logs it to scoreHistory exactly once.
 */
export async function checkAndAwardPastEventPoints() {
  try {
    const now = new Date();
    
    // 1. Get all events that have ended (endTime <= now)
    const pastEvents = await db.query.events.findMany({
      where: lte(events.endTime, now),
    });

    for (const event of pastEvents) {
      // 2. Check if points have already been awarded for this event
      const existingAward = await db.query.scoreHistory.findFirst({
        where: eq(scoreHistory.eventId, event.id),
      });

      if (existingAward) {
        // Points already processed and awarded for this event
        continue;
      }

      // 3. Query all checked-in attendees for this event
      const attendees = await db.query.attendance.findMany({
        where: and(
          eq(attendance.eventId, event.id),
          eq(attendance.status, "attended")
        ),
        with: {
          user: {
            columns: {
              houseId: true,
            }
          }
        }
      });

      if (attendees.length === 0) {
        // No attendees, mark as processed with 0 points to prevent re-processing
        const allHouses = await db.query.houses.findMany();
        if (allHouses.length > 0) {
          await db.insert(scoreHistory).values({
            houseId: allHouses[0].id,
            eventId: event.id,
            delta: 0,
            reason: `Event "${event.title}" ended with no attendees. No points awarded.`,
          });
        }
        continue;
      }

      // 4. Count attendees grouped by house
      const houseCounts: Record<string, { count: number; name: string; color: string }> = {};
      const dbHouses = await db.query.houses.findMany();
      const houseMap = new Map(dbHouses.map(h => [h.id, h]));

      for (const att of attendees) {
        const houseId = att.user?.houseId;
        if (!houseId) continue; // Skip student without a house

        const houseObj = houseMap.get(houseId);
        if (!houseObj) continue;

        if (!houseCounts[houseId]) {
          houseCounts[houseId] = { count: 0, name: houseObj.name, color: houseObj.color ?? "" };
        }
        houseCounts[houseId].count++;
      }

      const houseList = Object.entries(houseCounts);
      if (houseList.length === 0) {
        // No attendees assigned to any house, mark processed
        if (dbHouses.length > 0) {
          await db.insert(scoreHistory).values({
            houseId: dbHouses[0].id,
            eventId: event.id,
            delta: 0,
            reason: `Event "${event.title}" ended but all checked-in students were unassigned. No points awarded.`,
          });
        }
        continue;
      }

      // 5. Find the maximum count of attendees
      let maxCount = -1;
      for (const [_, data] of houseList) {
        if (data.count > maxCount) {
          maxCount = data.count;
        }
      }

      // 6. Find all houses matching the maximum count (supports Ties)
      const winners = houseList.filter(([_, data]) => data.count === maxCount);
      const pointsToAward = event.pointsAwarded ?? 0;

      // 7. Award points to the winning house(s) in a database transaction
      await db.transaction(async (tx) => {
        for (const [winnerHouseId, data] of winners) {
          if (pointsToAward > 0) {
            await tx
              .update(houses)
              .set({
                points: sql`${houses.points} + ${pointsToAward}`,
              })
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
      });
    }
  } catch (error) {
    console.error("Failed to automatically check and award past event points:", error);
  }
}
