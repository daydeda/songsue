ALTER TABLE "attendance" DROP CONSTRAINT "attendance_event_id_events_id_fk";
--> statement-breakpoint
ALTER TABLE "score_history" DROP CONSTRAINT "score_history_house_id_houses_id_fk";
--> statement-breakpoint
ALTER TABLE "score_history" DROP CONSTRAINT "score_history_event_id_events_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_house_id_houses_id_fk" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;