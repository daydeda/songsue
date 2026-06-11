-- 0009: Convert naive `timestamp` columns to `timestamptz` and default the
-- database session timezone to Asia/Bangkok.
--
-- WHY: columns were `timestamp without time zone`, storing bare UTC wall-clock
-- with no offset, which reads 7h behind Bangkok in raw DB tools. The app already
-- renders Asia/Bangkok in the UI, so the stored instants are correct — this just
-- makes them unambiguous (timestamptz) and makes raw inspection show Bangkok.
--
-- SAFETY: non-destructive. The conversion only runs while a column is still
-- `timestamp without time zone` (idempotent / no double-convert), and reinterprets
-- existing values with `AT TIME ZONE 'UTC'` so the absolute instant is unchanged.
-- This mirrors the logic in src/db/migrate.ts (run via `npm run db:migrate`).

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

-- Default new sessions (psql / Supabase Studio / app pool) to Bangkok for display.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Bangkok');
END $$;
