import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Adding columns manually...");
  try {
    await db.execute(sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "walk_ins_enabled" boolean DEFAULT false;`);
    await db.execute(sql`ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'registered';`);
    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
  process.exit(0);
}

migrate();
