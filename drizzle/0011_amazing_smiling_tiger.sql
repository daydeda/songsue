CREATE TABLE "club_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "no_show_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" uuid,
	"message" text NOT NULL,
	"no_show_count_at_appeal" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "is_staff" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "owner_club_ids" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "owner_majors" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "staff_user_ids" jsonb;--> statement-breakpoint
ALTER TABLE "houses" ADD COLUMN "faculty" text DEFAULT 'CAMT' NOT NULL;--> statement-breakpoint
ALTER TABLE "houses" ADD COLUMN "color_group" text DEFAULT 'red' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "no_show_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registration_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "faculty" text;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_members" ADD CONSTRAINT "club_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_show_appeals" ADD CONSTRAINT "no_show_appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_show_appeals" ADD CONSTRAINT "no_show_appeals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "club_members_club_user_unique" ON "club_members" USING btree ("club_id","user_id");--> statement-breakpoint
CREATE INDEX "club_members_user_idx" ON "club_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "club_members_club_idx" ON "club_members" USING btree ("club_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clubs_active_name_unique" ON "clubs" USING btree ("name") WHERE "clubs"."is_archived" = false;--> statement-breakpoint
CREATE INDEX "no_show_appeals_user_idx" ON "no_show_appeals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "no_show_appeals_status_idx" ON "no_show_appeals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "no_show_appeals_event_idx" ON "no_show_appeals" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "no_show_appeals_one_pending_per_user_event" ON "no_show_appeals" USING btree ("user_id","event_id") WHERE "no_show_appeals"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_houses_color_group" ON "houses" USING btree ("color_group");--> statement-breakpoint
CREATE INDEX "idx_houses_faculty" ON "houses" USING btree ("faculty");