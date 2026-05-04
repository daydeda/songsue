
import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";

async function promoteAdmin() {
  const email = "smocamt.official@gmail.com";
  console.log(`Promoting ${email} to admin...`);

  const result = await db.update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email))
    .returning();

  if (result.length > 0) {
    console.log("Success! User promoted to admin.");
    console.log(result[0]);
  } else {
    console.log("User not found. Make sure they have logged in at least once.");
  }
  process.exit(0);
}

promoteAdmin().catch(console.error);
