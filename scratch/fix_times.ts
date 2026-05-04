import { db } from "../src/db";
import { attendance } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Fixing attendance check-in times (subtracting 7 hours)...");
  
  // Update all records to subtract 7 hours
  // This assumes the DB stored local time but we want to treat it as UTC for display logic
  const res = await db.update(attendance).set({
    checkInTime: sql`check_in_time - interval '7 hours'`
  });
  
  console.log("Done!");
  process.exit(0);
}

main().catch(console.error);
