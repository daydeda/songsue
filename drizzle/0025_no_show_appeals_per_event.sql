-- No-show appeals become per-EVENT instead of one blanket appeal per account:
-- a student with multiple strikes can appeal each no-show event separately,
-- and an admin approving one appeal only undoes that event's strike (see
-- api/admin/appeals/[id]/route.ts), not the student's whole strike count.
--
-- event_id is nullable so adding it stays additive/non-destructive against any
-- pre-existing rows; every new appeal going forward is required (at the app
-- layer) to set it. The old one-pending-per-user unique index is replaced with
-- one scoped to (user_id, event_id) so a student may have concurrently-pending
-- appeals for different events, just not two for the same event.
--
-- Additive only. The statements this repo actually runs against prod live in
-- src/db/migrate.ts (step 69) — this file mirrors them for documentation,
-- matching the convention of 0012-0024.
ALTER TABLE "no_show_appeals" ADD COLUMN IF NOT EXISTS "event_id" uuid REFERENCES "public"."events"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "no_show_appeals_event_idx" ON "no_show_appeals" USING btree ("event_id");
--> statement-breakpoint
DROP INDEX IF EXISTS "no_show_appeals_one_pending_per_user";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "no_show_appeals_one_pending_per_user_event" ON "no_show_appeals" USING btree ("user_id","event_id") WHERE "no_show_appeals"."status" = 'pending';
