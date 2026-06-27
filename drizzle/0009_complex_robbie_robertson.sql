CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "seq" bigserial NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_rate_limit_expires_at" ON "rate_limit" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_attendance_event_status" ON "attendance" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_seq" ON "audit_logs" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "idx_forms_event_id" ON "forms" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_created_at" ON "users" USING btree ("created_at");