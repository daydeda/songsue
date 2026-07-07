-- No-show strike-out: students who pre-register for an event but never check
-- in accumulate strikes; at 3 strikes registrationBlocked flips true, blocking
-- new pre-registration until a staff member resets it.
--
-- Additive only, NOT NULL with a default so existing rows backfill
-- automatically. No data transformation, no drop. The statements this repo
-- actually runs against prod live in src/db/migrate.ts (step 67) — this file
-- mirrors them for documentation, matching the convention of 0012-0022.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "no_show_count" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "registration_blocked" boolean NOT NULL DEFAULT false;
