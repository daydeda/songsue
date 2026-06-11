-- 0010: Schema changes from the security/correctness audit batch (findings 2–15
-- and low-severity quick wins). Idempotent and non-destructive except for the
-- intentional de-duplication of form_submissions.
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — every statement here is guarded so a second run is a no-op.

-- 1. Backfill NULL points then enforce NOT NULL. A single NULL poisons every future
--    `points + delta` increment (NULL + n = NULL), silently zeroing a house/student.
UPDATE houses SET points = 0 WHERE points IS NULL;
UPDATE users  SET points = 0 WHERE points IS NULL;
ALTER TABLE houses ALTER COLUMN points SET NOT NULL;
ALTER TABLE users  ALTER COLUMN points SET NOT NULL;

-- 2. Drop UNIQUE on users.name — two students can share a Google display name; the
--    second was getting a permanent sign-in failure.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_unique;

-- 3. Event winner-bonus "processed" flag. Replaces inferring "already awarded" from
--    any score_history row (which let mid-event individual/milestone/manual rows
--    suppress the house winner bonus). Backfill stamps every already-ended event that
--    has any score_history row, preserving prior behavior on historical data.
ALTER TABLE events ADD COLUMN IF NOT EXISTS winner_awarded_at timestamptz;
UPDATE events e
SET winner_awarded_at = COALESCE(
  (SELECT max(sh.timestamp) FROM score_history sh WHERE sh.event_id = e.id),
  now()
)
WHERE e.winner_awarded_at IS NULL
  AND e.end_time <= now()
  AND EXISTS (SELECT 1 FROM score_history sh WHERE sh.event_id = e.id);

-- 4. De-duplicate form_submissions (keep earliest per student+form), then add the
--    unique index that blocks duplicate-submission point farming.
DELETE FROM form_submissions fs
USING form_submissions keep
WHERE fs.form_id = keep.form_id
  AND fs.student_id = keep.student_id
  AND (fs.submitted_at > keep.submitted_at
    OR (fs.submitted_at = keep.submitted_at AND fs.id > keep.id));
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_submissions_form_student
  ON form_submissions (form_id, student_id);
