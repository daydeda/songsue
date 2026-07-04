-- 0014: Per-attendee individual points for events.
-- individual_points_awarded is a SECOND, independent point pool, parallel to
-- points_awarded (the house winner bonus awarded winner-take-all at event-end).
-- These individual points are added to users.points the moment a check-in becomes
-- 'attended' (per session, so multi-day attendance compounds). NULL/0 means the
-- event grants no individual points (the default for every existing event).
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — the statement is guarded so a second run is a no-op.

ALTER TABLE events ADD COLUMN IF NOT EXISTS individual_points_awarded integer DEFAULT 0;
