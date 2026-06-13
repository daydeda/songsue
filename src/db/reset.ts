/**
 * Database Reset & Admin Setup Script
 * Run with: npx tsx src/db/reset.ts
 */
import { db } from "./index";
import { 
  houses, 
  users, 
  events, 
  attendance, 
  scoreHistory, 
  accounts, 
  sessions,
  verificationTokens,
  auditLogs
} from "./schema";
import { sql } from "drizzle-orm";
import { assertDestructiveAllowed } from "./guard";

const HOUSES = [
  { id: "red",    name: "Mom",   color: "#ef4444" },
  { id: "green",  name: "To",      color: "#14b8a6" },
  { id: "yellow", name: "Luang",  color: "#f59e0b" },
  { id: "blue",   name: "Makon", color: "#6366f1" },
];

async function reset() {
  assertDestructiveAllowed("db:reset (DELETES ALL DATA)");
  console.log("🧨 Resetting Database...");

  try {
    // 1. Clear all data (Order matters for FK constraints)
    console.log("  🧹 Clearing existing data...");
    await db.delete(scoreHistory);
    await db.delete(attendance);
    await db.delete(events);
    await db.delete(sessions);
    await db.delete(accounts);
    await db.delete(verificationTokens);
    await db.delete(auditLogs);
    await db.delete(users);
    await db.delete(houses);

    // 2. Seed Houses
    console.log("  🌱 Seeding houses...");
    for (const house of HOUSES) {
      await db.insert(houses).values({ 
        id: house.id, 
        name: house.name, 
        color: house.color, 
        points: 0 
      });
      console.log(`    ✅ House: ${house.name}`);
    }

    // 3. Create Admin User
    const adminEmail = "smocamt.official@gmail.com";
    console.log(`  👤 Setting up admin: ${adminEmail}`);
    
    await db.insert(users).values({
      id: crypto.randomUUID(),
      name: "Admin",
      email: adminEmail,
      role: "admin",
      qrToken: crypto.randomUUID(),
      profileCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("\n✨ Database reset successfully!");
    console.log("👉 Next steps:");
    console.log(`   1. Sign in with ${adminEmail}`);
    console.log("   2. You will have full admin access immediately.");
    
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  }
}

reset();
