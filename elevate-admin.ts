import { db } from "./src/db";
import { users } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { assertDestructiveAllowed } from "./src/db/guard";

async function elevate() {
  const email = process.argv[2];
  if (!email) {
    console.error("❌ Please provide an email address: tsx --env-file=.env elevate-admin.ts user@example.com");
    process.exit(1);
  }

  assertDestructiveAllowed("elevate-admin (grants admin role)");

  console.log(`🚀 Elevating user ${email} to admin...`);

  // Must set BOTH columns: src/auth.ts derives the session role from
  // users.roles (the multi-role array) first, falling back to users.role only
  // when roles is empty — and every user already has roles=["student"]
  // materialized by the column default from their first sign-in, so writing
  // role alone here silently has no effect on what the app actually sees.
  const result = await db.update(users)
    .set({ role: "admin", roles: ["admin"] })
    .where(eq(users.email, email))
    .returning();

  if (result.length > 0) {
    console.log(`✅ Success! ${email} is now an admin.`);
    console.log(`🔗 Access the admin panel at: http://localhost:3000/admin/dashboard`);
  } else {
    console.error(`❌ User with email ${email} not found in database.`);
  }
  
  process.exit(0);
}

elevate().catch(err => {
  console.error("❌ Failed to elevate user:", err);
  process.exit(1);
});
