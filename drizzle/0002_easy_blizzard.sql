ALTER TABLE "attendance" ALTER COLUMN "check_in_time" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "status" text DEFAULT 'registered';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "walk_ins_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_transform" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_medication" text;