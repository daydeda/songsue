ALTER TABLE "score_history" ADD COLUMN "form_id" uuid;--> statement-breakpoint
ALTER TABLE "score_history" ADD CONSTRAINT "score_history_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_score_history_form" ON "score_history" USING btree ("form_id");