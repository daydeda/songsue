-- 0015: Per-submitter individual points for evaluation forms.
-- individual_points_awarded is the form analogue of events.individual_points_awarded
-- (0014). points_awarded stays the house contest (winner-take-all to the house with
-- the most submissions at close); this is added to users.points the moment a student
-- submits the form, and is NOT clawed back if the form re-opens (the submission
-- persists). NULL/0 = the form grants no individual points (the default).
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — the statement is guarded so a second run is a no-op.

ALTER TABLE forms ADD COLUMN IF NOT EXISTS individual_points_awarded integer DEFAULT 0;
