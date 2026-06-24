CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"body" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"event_id" uuid,
	"allowed_roles" jsonb,
	"allowed_majors" jsonb,
	"target_thai" boolean DEFAULT true,
	"target_international" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_feed_tokens" (
	"user_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone,
	CONSTRAINT "calendar_feed_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "event_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"quota_walk_in" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"variant_label" text NOT NULL,
	"unit_price" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"slip_path" text,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"image_urls" jsonb,
	"max_per_order" integer,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"payment_info" text DEFAULT '' NOT NULL,
	"qr_image_url" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text NOT NULL,
	"stock" integer,
	"allow_custom" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forms" DROP CONSTRAINT "forms_event_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_name_unique";--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_student_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_scanned_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_target_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" ALTER COLUMN "check_in_time" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "start_time" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "end_time" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "registration_close_time" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "form_submissions" ALTER COLUMN "submitted_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "form_submissions" ALTER COLUMN "submitted_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "houses" ALTER COLUMN "points" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "score_history" ALTER COLUMN "house_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "score_history" ALTER COLUMN "timestamp" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "score_history" ALTER COLUMN "timestamp" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "emailVerified" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "points" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verificationToken" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "session_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "prev_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "row_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "registration_open_time" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_urls" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "quota_walk_in" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "registration_mode" text DEFAULT 'once' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "managed_by_roles" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "allowed_majors" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "winner_awarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "form_type" text DEFAULT 'K_post' NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "opens_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "closes_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "assigned_roles" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "assigned_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_feed_tokens" ADD CONSTRAINT "calendar_feed_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sessions" ADD CONSTRAINT "event_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_product_id_shop_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_variant_id_shop_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."shop_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_variants" ADD CONSTRAINT "shop_variants_product_id_shop_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_calendar_entries_start" ON "calendar_entries" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "idx_calendar_entries_event" ON "calendar_entries" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_sessions_event" ON "event_sessions" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_sessions_event_order" ON "event_sessions" USING btree ("event_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_shop_order_items_order" ON "shop_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_shop_order_items_variant" ON "shop_order_items" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_shop_orders_buyer" ON "shop_orders" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_shop_orders_status" ON "shop_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_shop_variants_product" ON "shop_variants" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_session_id_event_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_scanned_by_users_id_fk" FOREIGN KEY ("scanned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_userid" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_attendance_session_student" ON "attendance" USING btree ("session_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_event_student" ON "attendance" USING btree ("event_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_student" ON "attendance" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_checkin_time" ON "attendance" USING btree ("check_in_time");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_form_submissions_form_student" ON "form_submissions" USING btree ("form_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_score_history_event" ON "score_history" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_score_history_timestamp" ON "score_history" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_session_userid" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_users_profile_completed" ON "users" USING btree ("profile_completed");--> statement-breakpoint
CREATE INDEX "idx_users_house_id" ON "users" USING btree ("house_id");