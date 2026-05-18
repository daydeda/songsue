import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

async function run() {
  try {
    console.log("Dropping existing forms tables for a clean rebuild...");
    await sql`DROP TABLE IF EXISTS "form_submissions" CASCADE;`;
    await sql`DROP TABLE IF EXISTS "forms" CASCADE;`;
    console.log("✓ Dropped old tables.");

    console.log("Re-creating forms tables...");

    // 1. Create forms table
    await sql`
      CREATE TABLE "forms" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "event_id" uuid NOT NULL UNIQUE,
        "title" text NOT NULL,
        "description" text,
        "questions" jsonb NOT NULL,
        "points_awarded" integer DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      );
    `;
    console.log("✓ Created 'forms' table with all columns.");

    // 2. Create form_submissions table
    await sql`
      CREATE TABLE "form_submissions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "form_id" uuid NOT NULL,
        "student_id" text NOT NULL,
        "answers" jsonb NOT NULL,
        "submitted_at" timestamp DEFAULT now()
      );
    `;
    console.log("✓ Created 'form_submissions' table.");

    // 3. Add foreign keys
    await sql`
      ALTER TABLE "forms" 
      ADD CONSTRAINT "forms_event_id_events_id_fk" 
      FOREIGN KEY ("event_id") REFERENCES "events"("id") 
      ON DELETE cascade;
    `;
    console.log("✓ Added forms event FK constraint.");

    await sql`
      ALTER TABLE "form_submissions" 
      ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" 
      FOREIGN KEY ("form_id") REFERENCES "forms"("id") 
      ON DELETE cascade;
    `;
    console.log("✓ Added form_submissions form FK constraint.");

    await sql`
      ALTER TABLE "form_submissions" 
      ADD CONSTRAINT "form_submissions_student_id_users_id_fk" 
      FOREIGN KEY ("student_id") REFERENCES "users"("id") 
      ON DELETE cascade;
    `;
    console.log("✓ Added form_submissions student FK constraint.");

    console.log("Migration completed successfully with clean rebuild!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
