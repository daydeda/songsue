import { db } from "../src/db";
import { events } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function checkEvent() {
  const eventId = "16a39900-d941-44aa-bac2-e81c8f4cf78d";
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });
  console.log(JSON.stringify(event, null, 2));
}

checkEvent().catch(console.error);
