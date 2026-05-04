import { db } from "../src/db";
import { users } from "../src/db/schema";
import { isNull, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function main() {
  console.log("Fixing missing qrTokens for all users...");
  
  const missing = await db.query.users.findMany({
    where: isNull(users.qrToken)
  });
  
  console.log(`Found ${missing.length} users with missing tokens.`);
  
  for (const user of missing) {
    const newToken = randomUUID();
    console.log(`Updating ${user.email} -> ${newToken}`);
    await db.update(users)
      .set({ qrToken: newToken })
      .where(eq(users.id, user.id));
  }
  
  console.log("Done!");
  process.exit(0);
}

main().catch(console.error);
