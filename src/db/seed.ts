/**
 * Database Seed Script
 * Run with: npx tsx src/db/seed.ts
 *
 * Seeds the 4 houses required for the Balanced House Assignment system (FE-03).
 * Must be run once after the initial `npm run db:push`.
 */
import { db } from "./index";
import { houses } from "./schema";


const HOUSES = [
  { id: "red",    name: "Lanna",   color: "#ef4444" },
  { id: "green",  name: "Mengrai", color: "#14b8a6" },
  { id: "yellow", name: "Kawila",  color: "#f59e0b" },
  { id: "blue",   name: "Dara",    color: "#6366f1" },
];

async function seed() {
  console.log("🌱 Seeding houses...");

  for (const house of HOUSES) {
    await db
      .insert(houses)
      .values({ id: house.id, name: house.name, color: house.color, points: 0 })
      .onConflictDoUpdate({
        target: houses.id,
        set: { name: house.name, color: house.color }
      });
    console.log(`  ✅ House: ${house.name}`);
  }

  console.log("✅ Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
