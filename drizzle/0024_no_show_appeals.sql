-- No-show strike-out appeals: lets a registration-blocked student (see
-- users.no_show_count / users.registration_blocked, step 67) submit an appeal
-- message instead of only ever waiting on a manual staff reset. Admins review
-- from a new admin tab and approve/reject.
--
-- no_show_count_at_appeal snapshots users.no_show_count at submission time so
-- an admin reviewing later still sees the context even if the count has since
-- changed. The partial unique index blocks a user from having more than one
-- 'pending' appeal open at once (spam guard) — once it's approved/rejected they
-- can submit again if blocked again.
--
-- Additive only: new table, no ALTER/DROP touching existing tables. The
-- statements this repo actually runs against prod live in src/db/migrate.ts
-- (step 68) — this file mirrors them for documentation, matching the
-- convention of 0012-0023.
CREATE TABLE IF NOT EXISTS "no_show_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"message" text NOT NULL,
	"no_show_count_at_appeal" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "no_show_appeals_user_idx" ON "no_show_appeals" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "no_show_appeals_status_idx" ON "no_show_appeals" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "no_show_appeals_one_pending_per_user" ON "no_show_appeals" USING btree ("user_id") WHERE "no_show_appeals"."status" = 'pending';
