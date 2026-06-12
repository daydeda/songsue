-- Add form_type ('K_pre'|'K_post'|'A'|'S') and sort_order to forms.
-- Drop the single-form-per-event unique constraint so each event can have
-- multiple forms of different types (up to 4: K Pre, K Post, A, S).

ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "form_type" text NOT NULL DEFAULT 'K_post';
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0;
ALTER TABLE "forms" DROP CONSTRAINT IF EXISTS "forms_event_id_unique";
CREATE INDEX IF NOT EXISTS "idx_forms_event_type_order" ON "forms"("event_id", "form_type", "sort_order");
