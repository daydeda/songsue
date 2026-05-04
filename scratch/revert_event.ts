import { db } from "../src/db";
import { events } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function revertEvent() {
  const eventId = "16a39900-d941-44aa-bac2-e81c8f4cf78d";
  
  // Revert end time to match start time (how it was)
  const startTime = new Date("2026-05-03T22:00:00.000Z");

  await db.update(events)
    .set({ endTime: startTime })
    .where(eq(events.id, eventId));

  console.log("Event end time reverted to:", startTime.toISOString());
}

revertEvent().catch(console.error);
