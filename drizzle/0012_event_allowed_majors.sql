-- 0012: Major-based access control for events.
-- Pairs with allowed_roles: an event can be limited to specific student majors
-- (ANI, DG, DII, MMIT, SE). NULL or [] means open to every major; a non-empty
-- array restricts registration/visibility to those majors and is combined with
-- allowed_roles as AND. Admin roles always bypass.
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — the statement is guarded so a second run is a no-op.

ALTER TABLE events ADD COLUMN IF NOT EXISTS allowed_majors jsonb;
