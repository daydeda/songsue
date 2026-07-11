ALTER TABLE "event_proposals" ADD COLUMN "walk_ins_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "walk_ins_only" boolean DEFAULT false;