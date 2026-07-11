ALTER TABLE "event_proposals" ADD COLUMN "registration_open_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "registration_close_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "image_urls" jsonb;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "walk_ins_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "quota_walk_in" integer;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "registration_mode" text DEFAULT 'once' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "target_thai" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "target_international" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "quota_thai" integer;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "quota_international" integer;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "first_year_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD COLUMN "staff_user_ids" jsonb;