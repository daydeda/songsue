ALTER TABLE "houses" ADD COLUMN "faculty" text DEFAULT 'CAMT' NOT NULL;--> statement-breakpoint
ALTER TABLE "houses" ADD COLUMN "color_group" text DEFAULT 'red' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "faculty" text;--> statement-breakpoint
CREATE INDEX "idx_houses_color_group" ON "houses" USING btree ("color_group");--> statement-breakpoint
CREATE INDEX "idx_houses_faculty" ON "houses" USING btree ("faculty");