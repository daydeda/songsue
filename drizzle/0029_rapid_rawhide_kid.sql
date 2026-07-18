ALTER TABLE "events" ADD COLUMN "pending_details_changes" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pending_details_submitted_by" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pending_details_submitted_at" timestamp with time zone;