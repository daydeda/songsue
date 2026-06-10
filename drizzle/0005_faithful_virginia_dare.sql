ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_student_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "score_history" DROP CONSTRAINT "score_history_form_id_forms_id_fk";
--> statement-breakpoint
ALTER TABLE "form_submissions" ALTER COLUMN "answers" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "form_submissions" ALTER COLUMN "answers" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "registration_close_time" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "target_thai" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "target_international" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quota_thai" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quota_international" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allowed_roles" jsonb;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "submitted_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "event_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "questions" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "is_awarded" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "roles" jsonb DEFAULT '["student"]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "points" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "forms" DROP COLUMN "end_time";--> statement-breakpoint
ALTER TABLE "forms" DROP COLUMN "fields";--> statement-breakpoint
ALTER TABLE "score_history" DROP COLUMN "form_id";--> statement-breakpoint
ALTER TABLE "forms" ADD CONSTRAINT "forms_event_id_unique" UNIQUE("event_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_name_unique" UNIQUE("name");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");