import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const email = "smocamt.official@gmail.com"; // Assuming this is the user
  console.log(`Checking user: ${email}`);
  
  const user = await db.query.users.findFirst({
    where: eq(users.email, email)
  });
  
  if (!user) {
    console.log("User not found!");
  } else {
    console.log("User data:", JSON.stringify(user, null, 2));
  }
  process.exit(0);
}

main().catch(console.error);
