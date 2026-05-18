import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding is_awarded column to forms table...");
  try {
    await db.execute(sql`ALTER TABLE forms ADD COLUMN IF NOT EXISTS is_awarded BOOLEAN DEFAULT false;`);
    console.log("Column added successfully!");
  } catch (error) {
    console.error("Failed to add column:", error);
  }
  process.exit(0);
}

main();
