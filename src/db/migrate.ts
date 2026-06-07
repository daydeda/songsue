/**
 * Incremental Migration Script
 * Adds new columns and tables introduced in this session.
 * Safe to run on an existing DB — uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is not set.");
  process.exit(1);
}

async function migrate() {
  console.log("🔄 Applying incremental migration...");
  const sql = postgres(connectionString, { max: 1 });

  // 1. Add qr_token column to users (if not exists)
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS qr_token text UNIQUE
  `;
  console.log("  ✅ users.qr_token");

  // 2. Add pdpa_consent column to users
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS pdpa_consent boolean DEFAULT false
  `;
  console.log("  ✅ users.pdpa_consent");

  // 3. Add color column to houses
  await sql`
    ALTER TABLE houses
    ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1'
  `;
  console.log("  ✅ houses.color");

  // 4. Add points_awarded column to events
  await sql`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS points_awarded integer DEFAULT 0
  `;
  console.log("  ✅ events.points_awarded");

  // 5. Create score_history table
  await sql`
    CREATE TABLE IF NOT EXISTS score_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      house_id text NOT NULL REFERENCES houses(id),
      event_id uuid REFERENCES events(id),
      delta integer NOT NULL,
      reason text NOT NULL,
      timestamp timestamp DEFAULT now()
    )
  `;
  console.log("  ✅ score_history table");

  // 6. Add position column to users
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS position text
  `;
  console.log("  ✅ users.position");

  // 7. Add image_transform column to users
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS image_transform jsonb
  `;
  console.log("  ✅ users.image_transform");

  // 8. Add emergency_medication column to users
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS emergency_medication text
  `;
  console.log("  ✅ users.emergency_medication");

  // 9. Add meds_check_option column to attendance
  await sql`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS meds_check_option text
  `;
  console.log("  ✅ attendance.meds_check_option");

  // 10. Add unique constraints to users.name and users.phone
  try {
    await sql`
      ALTER TABLE users
      ADD CONSTRAINT users_name_unique UNIQUE (name)
    `;
    console.log("  ✅ users.name unique constraint");
  } catch (e) {
    console.log("  ⚠️ users.name unique constraint already exists or failed to apply (make sure there are no duplicates)");
  }

  try {
    await sql`
      ALTER TABLE users
      ADD CONSTRAINT users_phone_unique UNIQUE (phone)
    `;
    console.log("  ✅ users.phone unique constraint");
  } catch (e) {
    console.log("  ⚠️ users.phone unique constraint already exists or failed to apply (make sure there are no duplicates)");
  }

  console.log("✅ Migration complete!");
  await sql.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
