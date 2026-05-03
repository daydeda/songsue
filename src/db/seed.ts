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
  { id: "red",    name: "Red House",    color: "#ef4444" },
  { id: "blue",   name: "Blue House",   color: "#3b82f6" },
  { id: "green",  name: "Green House",  color: "#22c55e" },
  { id: "yellow", name: "Yellow House", color: "#eab308" },
];

async function seed() {
  console.log("🌱 Seeding houses...");

  for (const house of HOUSES) {
    await db
      .insert(houses)
      .values({ id: house.id, name: house.name, color: house.color, points: 0 })
      .onConflictDoNothing();
    console.log(`  ✅ House: ${house.name}`);
  }

  console.log("✅ Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
