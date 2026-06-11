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

  // 11. Add allowed_roles column to events for role-based access control
  await sql`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS allowed_roles jsonb
  `;
  console.log("  ✅ events.allowed_roles");

  // 12. Add roles column to users (if not exists) and backfill from single role
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS roles jsonb DEFAULT '["student"]'::jsonb
  `;
  console.log("  ✅ users.roles");

  // Backfill roles column from role column only for users without any roles set
  await sql`
    UPDATE users SET roles = jsonb_build_array(role) WHERE roles IS NULL AND role IS NOT NULL
  `;
  console.log("  ✅ backfilled users.roles from users.role where roles was NULL");

  // 13. Add registration_close_time column to events
  await sql`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS registration_close_time timestamp
  `;
  console.log("  ✅ events.registration_close_time");

  // 14. Add points column to users
  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS points integer DEFAULT 0
  `;
  console.log("  ✅ users.points");

  // 15. Promote attendance(event_id, student_id) index to UNIQUE constraint
  // to prevent duplicate check-in records under concurrent scans.
  try {
    await sql`DROP INDEX IF EXISTS idx_attendance_event_student`;
    await sql`
      ALTER TABLE attendance
      ADD CONSTRAINT attendance_event_student_unique UNIQUE (event_id, student_id)
    `;
    console.log("  ✅ attendance unique constraint on (event_id, student_id)");
  } catch {
    console.log("  ⚠️  attendance unique constraint already exists, skipping");
  }

  // 16. Add tamper-evident hash chain columns to audit_logs
  await sql`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS prev_hash text NOT NULL DEFAULT ''
  `;
  await sql`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS row_hash text NOT NULL DEFAULT ''
  `;
  console.log("  ✅ audit_logs.prev_hash + row_hash (tamper-evident chain)");

  // 17. Add registration_open_time column to events (pairs with close time
  // to define a registration window; NULL = already open).
  await sql`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS registration_open_time timestamp
  `;
  // 18. Add quota_walk_in column to events
  await sql`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS quota_walk_in integer
  `;
  console.log("  ✅ events.quota_walk_in");

  console.log("✅ Migration complete!");
  await sql.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
