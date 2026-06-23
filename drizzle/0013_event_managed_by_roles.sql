-- 0013: President-managed events.
-- managed_by_roles lists which president role(s) (club_president / major_president)
-- MANAGE this event — i.e. see it in their admin events list, view attendance,
-- scan, and export. This is SEPARATE from allowed_roles, which governs participant
-- (student) visibility/registration. NULL or [] means not president-managed (only
-- staff manage it).
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — the statement is guarded so a second run is a no-op.

ALTER TABLE events ADD COLUMN IF NOT EXISTS managed_by_roles jsonb;
