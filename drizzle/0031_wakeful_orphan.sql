-- NOTE: This column was already added to every real database (prod/legacy/local)
-- via `src/db/migrate.ts` step 6 (`ALTER TABLE users ADD COLUMN IF NOT EXISTS
-- position text`), long before it was ever declared in `src/db/schema.ts`. This
-- file exists purely for drizzle-kit snapshot/history parity — it is NOT an
-- execution path (this repo has no `drizzle-kit migrate` npm script, so files
-- under `drizzle/` are never applied to a live database). Do not add a
-- corresponding step to `migrate.ts`; it would be a pure no-op.
ALTER TABLE "users" ADD COLUMN "position" text;
