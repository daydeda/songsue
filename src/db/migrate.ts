/**
 * Incremental Migration Script
 * Adds new columns and tables introduced in this session.
 * Safe to run on an existing DB — uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS.
 */
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is not set.");
  process.exit(1);
}

// The Supabase transaction pooler (port 6543) runs in transaction mode and does
// NOT support prepared statements — postgres-js must use the simple query
// protocol there, or every DDL statement fails. Mirrors src/db/index.ts.
const usingTransactionPooler = connectionString.includes(":6543");

async function migrate() {
  console.log("🔄 Applying incremental migration...");
  const sql = postgres(connectionString, { max: 1, prepare: !usingTransactionPooler });

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

  // 19. Convert all naive `timestamp` columns to `timestamptz` (timestamp with
  // time zone) so stored values are unambiguous instants instead of bare
  // wall-clock with no offset.
  //
  // SAFETY / NON-DESTRUCTIVE:
  //  - Idempotent: each column is only altered while it is still
  //    `timestamp without time zone`. Re-running is a no-op (so it never
  //    double-converts a timestamptz back to naive).
  //  - Instant-preserving: existing naive values are reinterpreted with
  //    `AT TIME ZONE 'UTC'`. In production the DB session is UTC and
  //    postgres-js already reads these naive values AS UTC, so the absolute
  //    instant is unchanged — nothing in the app shifts. The UI keeps
  //    converting to Asia/Bangkok at render time exactly as before.
  await sql`
    DO $$
    DECLARE
      r record;
    BEGIN
      FOR r IN
        SELECT * FROM (VALUES
          ('users', 'emailVerified'),
          ('users', 'created_at'),
          ('users', 'updated_at'),
          ('session', 'expires'),
          ('verificationToken', 'expires'),
          ('events', 'start_time'),
          ('events', 'end_time'),
          ('events', 'registration_open_time'),
          ('events', 'registration_close_time'),
          ('events', 'created_at'),
          ('events', 'updated_at'),
          ('attendance', 'check_in_time'),
          ('score_history', 'timestamp'),
          ('audit_logs', 'timestamp'),
          ('forms', 'created_at'),
          ('forms', 'updated_at'),
          ('form_submissions', 'submitted_at')
        ) AS t(tbl, col)
      LOOP
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = r.tbl
            AND column_name = r.col
            AND data_type = 'timestamp without time zone'
        ) THEN
          EXECUTE format(
            'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
            r.tbl, r.col, r.col
          );
        END IF;
      END LOOP;
    END $$;
  `;
  console.log("  ✅ converted timestamp columns to timestamptz (instant-preserving)");

  // 20. Default new DB sessions (psql, Supabase Studio, the app's pooled
  // connections) to Asia/Bangkok so raw timestamptz values DISPLAY as Bangkok
  // local time. Changes only how instants are rendered to text, never the
  // stored instant — safe and reversible. Affects sessions opened AFTER this runs.
  await sql`
    DO $$
    BEGIN
      EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Bangkok');
    END $$;
  `;
  console.log("  ✅ database default timezone set to Asia/Bangkok");

  // 21. Backfill NULL points, then enforce NOT NULL. A single NULL poisons every
  // future `points + delta` increment (NULL + n = NULL), silently zeroing a house
  // or student. ALTER ... SET NOT NULL is a no-op if already enforced.
  await sql`UPDATE houses SET points = 0 WHERE points IS NULL`;
  await sql`UPDATE users  SET points = 0 WHERE points IS NULL`;
  await sql`ALTER TABLE houses ALTER COLUMN points SET NOT NULL`;
  await sql`ALTER TABLE users  ALTER COLUMN points SET NOT NULL`;
  console.log("  ✅ points columns backfilled and set NOT NULL");

  // 22. Drop the UNIQUE constraint on users.name. Two students can legitimately
  // share a Google display name; the second was getting a permanent sign-in failure.
  await sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_unique`;
  console.log("  ✅ dropped users_name_unique");

  // 23. Event winner-bonus "processed" flag. Replaces the buggy heuristic that
  // inferred "already awarded" from ANY score_history row on the event — which let
  // mid-event individual/milestone/manual rows suppress the house winner bonus.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS winner_awarded_at timestamptz`;
  // Backfill preserves existing behavior exactly: stamp every already-ended event
  // that has any score_history row (the OLD definition of "processed"), so the new
  // code never re-awards a bonus on historical data. Events with no score_history
  // stay NULL and process normally on the next run, same as before.
  await sql`
    UPDATE events e
    SET winner_awarded_at = COALESCE(
      (SELECT max(sh.timestamp) FROM score_history sh WHERE sh.event_id = e.id),
      now()
    )
    WHERE e.winner_awarded_at IS NULL
      AND e.end_time <= now()
      AND EXISTS (SELECT 1 FROM score_history sh WHERE sh.event_id = e.id)
  `;
  console.log("  ✅ events.winner_awarded_at added and backfilled");

  // 24. De-duplicate form_submissions (keep the earliest per student+form), then
  // add the unique index that blocks duplicate-submission point farming.
  await sql`
    DELETE FROM form_submissions fs
    USING form_submissions keep
    WHERE fs.form_id = keep.form_id
      AND fs.student_id = keep.student_id
      AND (fs.submitted_at > keep.submitted_at
        OR (fs.submitted_at = keep.submitted_at AND fs.id > keep.id))
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_form_submissions_form_student
    ON form_submissions (form_id, student_id)
  `;
  console.log("  ✅ form_submissions deduped + unique index");

  // 25. KAS multi-form: add form_type and sort_order to forms, drop single-form unique constraint
  await sql`
    ALTER TABLE forms
    ADD COLUMN IF NOT EXISTS form_type text NOT NULL DEFAULT 'K_post'
  `;
  console.log("  ✅ forms.form_type");

  await sql`
    ALTER TABLE forms
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0
  `;
  console.log("  ✅ forms.sort_order");

  try {
    await sql`ALTER TABLE forms DROP CONSTRAINT IF EXISTS forms_event_id_unique`;
    console.log("  ✅ dropped forms_event_id_unique constraint");
  } catch (e) {
    console.log("  ⚠️ forms_event_id_unique constraint already dropped or not found");
  }

  await sql`
    CREATE INDEX IF NOT EXISTS idx_forms_event_type_order ON forms(event_id, form_type, sort_order)
  `;
  console.log("  ✅ idx_forms_event_type_order index");

  // 26. Form scheduling window + assignment (who may see/fill a form). opens_at /
  // closes_at give each form an optional auto open/close window (like an event's
  // registration window); NULL means unbounded on that side. assigned_roles /
  // assigned_user_ids gate access to S (Skill) forms — empty arrays mean only
  // super_admin/admin can see the form until someone is assigned by role or person.
  await sql`ALTER TABLE forms ADD COLUMN IF NOT EXISTS opens_at timestamptz`;
  console.log("  ✅ forms.opens_at");
  await sql`ALTER TABLE forms ADD COLUMN IF NOT EXISTS closes_at timestamptz`;
  console.log("  ✅ forms.closes_at");
  await sql`ALTER TABLE forms ADD COLUMN IF NOT EXISTS assigned_roles jsonb NOT NULL DEFAULT '[]'::jsonb`;
  console.log("  ✅ forms.assigned_roles");
  await sql`ALTER TABLE forms ADD COLUMN IF NOT EXISTS assigned_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb`;
  console.log("  ✅ forms.assigned_user_ids");

  // 27. Drop ALL foreign keys on audit_logs (actor_id/target_id → users.id).
  // Those column values are baked into the tamper-evident row hashes, so any
  // rewrite (manual SET NULL on user deletion, or an ON DELETE action) breaks
  // chain verification. Without FKs the rows survive user deletion untouched;
  // the app joins via drizzle relations, which don't need DB-level constraints.
  await sql`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'audit_logs' AND con.contype = 'f'
      LOOP
        EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', r.conname);
      END LOOP;
    END $$;
  `;
  console.log("  ✅ dropped audit_logs foreign keys (rows must never be rewritten)");

  // 28. Index audit_logs.timestamp. Every audit append looks up the newest row
  // (ORDER BY timestamp DESC LIMIT 1) to get the previous chain hash, and it
  // does so while holding the advisory lock that serializes ALL audit writes —
  // so without an index, every write everywhere slows down as the table grows.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs ("timestamp")
  `;
  console.log("  ✅ idx_audit_logs_timestamp index");

  // 29. Multi-poster support: events can carry an ordered list of poster image
  // URLs (carousel on the student dashboard). image_urls[0] mirrors the existing
  // image_url cover. Backfill wraps any existing single image_url into the array
  // so legacy events render in the carousel exactly as before.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_urls jsonb`;
  await sql`
    UPDATE events
    SET image_urls = jsonb_build_array(image_url)
    WHERE image_urls IS NULL AND image_url IS NOT NULL AND image_url <> ''
  `;
  console.log("  ✅ events.image_urls added and backfilled from image_url");

  // 30. Dashboard announcement banner (singleton table). Admins (super_admin/
  // admin) edit the body + show/hide toggle from the admin panel instead of
  // editing hardcoded JSX. Seed ONE row with the text that was hardcoded on the
  // dashboard so the banner is unchanged on first deploy — only if empty, so a
  // re-run never clobbers an edited announcement.
  await sql`
    CREATE TABLE IF NOT EXISTS announcements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      body text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      updated_by text,
      updated_at timestamptz DEFAULT now()
    )
  `;
  await sql`
    INSERT INTO announcements (body, enabled)
    SELECT
      'ขณะนี้ Web Application ActiveCAMT อยู่ระหว่างการพัฒนาและทดสอบระบบเพื่อเพิ่มประสิทธิภาพในการใช้งานสูงสุด' || E'\n' ||
      'หากท่านพบข้อผิดพลาดหรือมีข้อสงสัยประการใด สามารถแจ้งปัญหาหรือติดต่อเราได้ที่ IG: smocamt.official',
      true
    WHERE NOT EXISTS (SELECT 1 FROM announcements)
  `;
  console.log("  ✅ announcements table created and seeded");

  // 31. Shop / merch. Five tables: a singleton settings row (payment QR + info +
  // on/off), products (multi-poster + rich-text description + per-buyer limit),
  // variants (sizes, each with its own stock), orders (slip + approval status),
  // and order line items (snapshots so deleting a product never rewrites history).
  await sql`
    CREATE TABLE IF NOT EXISTS shop_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      payment_info text NOT NULL DEFAULT '',
      qr_image_url text,
      updated_by text,
      updated_at timestamptz DEFAULT now()
    )
  `;
  await sql`
    INSERT INTO shop_settings (enabled, payment_info)
    SELECT false, ''
    WHERE NOT EXISTS (SELECT 1 FROM shop_settings)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shop_products (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      name text NOT NULL,
      description text NOT NULL DEFAULT '',
      price integer NOT NULL DEFAULT 0,
      image_url text,
      image_urls jsonb,
      max_per_order integer,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shop_variants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      product_id uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
      label text NOT NULL,
      stock integer,
      sort_order integer NOT NULL DEFAULT 0
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shop_variants_product ON shop_variants (product_id)`;
  // "Other (specify)" option: buyer types a custom value at checkout.
  await sql`ALTER TABLE shop_variants ADD COLUMN IF NOT EXISTS allow_custom boolean NOT NULL DEFAULT false`;
  // Optional per-product sale window (NULL = unbounded that side).
  await sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS opens_at timestamptz`;
  await sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS closes_at timestamptz`;

  await sql`
    CREATE TABLE IF NOT EXISTS shop_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      buyer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      slip_path text,
      total_amount integer NOT NULL DEFAULT 0,
      note text,
      reviewed_by text,
      reviewed_at timestamptz,
      rejection_reason text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shop_orders_buyer ON shop_orders (buyer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders (status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS shop_order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      order_id uuid NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
      product_id uuid REFERENCES shop_products(id) ON DELETE SET NULL,
      variant_id uuid REFERENCES shop_variants(id) ON DELETE SET NULL,
      product_name text NOT NULL,
      variant_label text NOT NULL,
      unit_price integer NOT NULL,
      quantity integer NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items (order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_shop_order_items_variant ON shop_order_items (variant_id)`;
  console.log("  ✅ shop tables (settings, products, variants, orders, order_items) created");

  // 32. Detach no-award activity rows from any house. An event/form that ends with no
  // real award (no attendance, all attendees unassigned, or 0 points configured) should
  // still appear in the Recent Activity feed, but attributed to NO house — pinning it to
  // an arbitrary house (the old behaviour), or naming a 0-point "winner", made no sense.
  //
  // Make house_id nullable, then convert the existing auto-generated 0-point rows to
  // house-less. The two no-attendance variants keep their (already neutral) text; the
  // 0-point "winner"/"contest" rows are also rewritten to a neutral, house-free reason
  // so the text no longer names a house. All scoped to delta = 0 + the exact generated
  // reason strings, so real point awards and manual/individual adjustments are untouched.
  // Idempotent: the rewrites change the reason out of the matched patterns, and
  // re-detaching an already-null house_id is a no-op.
  await sql`ALTER TABLE score_history ALTER COLUMN house_id DROP NOT NULL`;
  console.log("  ✅ score_history.house_id is now nullable");

  // No-attendance / all-unassigned: text is already neutral, just drop the house.
  await sql`
    UPDATE score_history
    SET house_id = NULL
    WHERE delta = 0
      AND house_id IS NOT NULL
      AND (
        reason LIKE 'Event "%" ended with no attendees. No points awarded.'
        OR reason LIKE 'Event "%" ended but all checked-in students were unassigned. No points awarded.'
      )
  `;

  // 0-point event "winner"/"tie winner": drop the house and neutralise the text.
  await sql`
    UPDATE score_history
    SET house_id = NULL,
        reason = 'Event "' || regexp_replace(reason, '^Event "(.*?)" completed!.*$', '\\1') || '" ended. No points awarded.'
    WHERE delta = 0
      AND (reason LIKE 'Event "%" completed! WINNER:%' OR reason LIKE 'Event "%" completed! TIE WINNER:%')
  `;

  // 0-point form contest "winner"/"tie winner": drop the house and neutralise the text.
  await sql`
    UPDATE score_history
    SET house_id = NULL,
        reason = 'Evaluation form "' || regexp_replace(reason, '.*evaluation form "(.*?)" most with.*$', '\\1') || '" closed. No points awarded.'
    WHERE delta = 0
      AND (reason LIKE 'Event Form Contest Winner:%' OR reason LIKE 'Event Form Contest Tie Winner:%')
  `;
  console.log("  ✅ detached no-award activity rows from any house (feed entries kept)");

  // 33. Major-based access control for events. Pairs with allowed_roles: an event
  // can be limited to specific student majors (ANI, DG, DII, MMIT, SE). NULL or []
  // means open to every major; a non-empty array restricts registration/visibility
  // to those majors and is combined with allowed_roles as AND. Admin roles bypass.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS allowed_majors jsonb`;
  console.log("  ✅ events.allowed_majors");

  // 34. Multi-day / multi-session check-in. A session = one occurrence of an event
  // (a day). Every event gets ≥1 session; attendance keys on the session, not the
  // event. Single-session events behave exactly as before. NON-DESTRUCTIVE and
  // idempotent throughout: create table, add nullable column, backfill, then
  // tighten the unique constraint and NOT NULL last. See
  // docs/features/multi-day-checkin-implementation.md.
  await sql`
    CREATE TABLE IF NOT EXISTS event_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      title text,
      start_time timestamptz NOT NULL,
      end_time timestamptz NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      quota_walk_in integer,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions (event_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_event_sessions_event_order ON event_sessions (event_id, sort_order)`;
  console.log("  ✅ event_sessions table");

  // 35. registration_mode on events ('once' | 'per_session'). Default 'once' so
  // every existing event is backward-compatible with zero behaviour change.
  await sql`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS registration_mode text NOT NULL DEFAULT 'once'
  `;
  console.log("  ✅ events.registration_mode");

  // 36. Add attendance.session_id NULLABLE first, so existing rows stay legal
  // until backfilled below.
  await sql`
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES event_sessions(id) ON DELETE CASCADE
  `;
  console.log("  ✅ attendance.session_id (nullable, pre-backfill)");

  // 37. Backfill one default session per event that has none. Copies the event's
  // own start/end + walk-in quota so a legacy single-day event becomes a 1-session
  // event identical to before. Idempotent via NOT EXISTS.
  await sql`
    INSERT INTO event_sessions (event_id, title, start_time, end_time, sort_order, quota_walk_in)
    SELECT e.id, NULL, e.start_time, e.end_time, 0, e.quota_walk_in
    FROM events e
    WHERE NOT EXISTS (SELECT 1 FROM event_sessions s WHERE s.event_id = e.id)
  `;
  console.log("  ✅ backfilled one default session per event");

  // 38. Backfill attendance.session_id from each event's earliest session, only
  // where NULL. After this every attendance row points at a session.
  await sql`
    UPDATE attendance a
    SET session_id = (
      SELECT s.id FROM event_sessions s
      WHERE s.event_id = a.event_id
      ORDER BY s.sort_order, s.start_time
      LIMIT 1
    )
    WHERE a.session_id IS NULL
  `;
  console.log("  ✅ backfilled attendance.session_id");

  // 39. Swap the uniqueness guard from (event_id, student_id) to
  // (session_id, student_id). ADD-NEW-BEFORE-DROP-OLD so there is never a window
  // without a duplicate-scan guard. Collision-safe: one event maps to exactly one
  // default session during backfill (step 37/38), so no (session_id, student_id)
  // pair can already be duplicated that wasn't already blocked by the old
  // (event_id, student_id) constraint. The old object is kept as a plain
  // non-unique index for the report/winner roll-ups that still query by event.
  try {
    await sql`
      ALTER TABLE attendance
      ADD CONSTRAINT attendance_session_student_unique UNIQUE (session_id, student_id)
    `;
    console.log("  ✅ attendance unique constraint on (session_id, student_id)");
  } catch {
    console.log("  ⚠️  attendance_session_student_unique already exists, skipping");
  }
  await sql`ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_event_student_unique`;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_event_student
    ON attendance (event_id, student_id)
  `;
  console.log("  ✅ replaced (event_id, student_id) unique with non-unique index");

  // 40. Enforce NOT NULL last, only after backfill + swap. If step 38 missed any
  // row this fails loudly BEFORE an event rather than mid-scan.
  await sql`ALTER TABLE attendance ALTER COLUMN session_id SET NOT NULL`;
  console.log("  ✅ attendance.session_id set NOT NULL");

  // 41. President-managed events. managed_by_roles lists which president role(s)
  // (club_president / major_president) MANAGE this event — i.e. see it in their
  // admin events list, view attendance, scan, and export. This is SEPARATE from
  // allowed_roles, which governs participant (student) visibility/registration.
  // NULL or [] = not president-managed (only staff manage it). Nullable, no
  // default, non-destructive.
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS managed_by_roles jsonb`;
  console.log("  ✅ events.managed_by_roles");

  // 42. Calendar entries — lightweight, calendar-only annotations (deadlines,
  // registration windows, "exam week"), optionally linked to an event. New table
  // only → inherently non-destructive. event_id is ON DELETE SET NULL so deleting
  // an event keeps the annotation. Visibility columns mirror events.* exactly so
  // the same eligibility predicate filters both. NEVER read by dashboard/scan/
  // attendance/points paths.
  await sql`
    CREATE TABLE IF NOT EXISTS calendar_entries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      title text NOT NULL,
      description text,
      location text,
      start_time timestamptz NOT NULL,
      end_time timestamptz NOT NULL,
      all_day boolean NOT NULL DEFAULT false,
      event_id uuid REFERENCES events(id) ON DELETE SET NULL,
      allowed_roles jsonb,
      allowed_majors jsonb,
      target_thai boolean DEFAULT true,
      target_international boolean DEFAULT true,
      created_by text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_calendar_entries_start ON calendar_entries (start_time)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_calendar_entries_event ON calendar_entries (event_id)`;
  console.log("  ✅ calendar_entries table");

  // 43. Per-user subscribe-feed token. The token IS the auth for the .ics feed
  // (the feed route never calls auth()), so it must be a stored, revocable secret.
  // One active token per user (PK on user_id); regenerate = overwrite the row.
  await sql`
    CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
      user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      token text NOT NULL UNIQUE,
      created_at timestamptz DEFAULT now(),
      last_used_at timestamptz
    )
  `;
  console.log("  ✅ calendar_feed_tokens table");

  // 44. score_history.form_id — ties a contest-award ledger row to the specific
  // form that produced it, so a re-opened form can revert ITS OWN award without
  // touching the event scans, manual adjustments, and event-winner bonus that
  // share the same event_id. Nullable + ON DELETE SET NULL: existing rows stay
  // legal (form_id NULL) and the ledger entry survives if the form is deleted.
  // Additive only — no data is rewritten or removed.
  await sql`
    ALTER TABLE score_history
    ADD COLUMN IF NOT EXISTS form_id uuid
  `;
  // Add the FK only if it isn't already present (Postgres has no
  // ADD CONSTRAINT IF NOT EXISTS). Guarded so re-runs are a no-op.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'score_history_form_id_forms_id_fk'
      ) THEN
        ALTER TABLE score_history
          ADD CONSTRAINT score_history_form_id_forms_id_fk
          FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_score_history_form ON score_history (form_id)`;
  console.log("  ✅ score_history.form_id (+ FK, index)");

  // 45. events.individual_points_awarded — a SECOND, independent point pool per
  // event. points_awarded (step 4) is the house winner bonus (winner-take-all at
  // event-end); this is per-attendee individual points added to users.points the
  // moment a check-in becomes 'attended' (per session, so multi-day attendance
  // compounds). Additive, nullable-with-default, non-destructive: existing events
  // default to 0 (no individual points), unchanged from before. Idempotent via
  // ADD COLUMN IF NOT EXISTS.
  await sql`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS individual_points_awarded integer DEFAULT 0
  `;
  console.log("  ✅ events.individual_points_awarded");

  console.log("✅ Migration complete!");
  await sql.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
