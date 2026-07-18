ALTER TABLE "event_proposals" ALTER COLUMN "club_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "major_code" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "details_review_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "details_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "details_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "review_status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "review_note" text;--> statement-breakpoint
CREATE INDEX "event_proposals_major_idx" ON "event_proposals" USING btree ("major_code");