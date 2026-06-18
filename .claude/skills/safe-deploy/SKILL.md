---
name: safe-deploy
description: Safe deploy + DB migration checklist for ActiveCAMT (Next.js + Supabase + Vercel). Use before deploying any change that touches the database schema, or before a Vercel deploy that reads a new or changed column. Enforces feature branch (never main), idempotent and non-destructive migrations, and migrating prod before deploying code that reads it.
---

# Safe Deploy (ActiveCAMT)

A guided checklist to ship a change without breaking prod. This codebase has bitten
us twice before: a `DELETE` step once wiped the whole activity feed, and code that
read a new column was deployed before the column existed in prod. This skill exists
to make both impossible to repeat.

## Hard rules (never violate)

1. **Never push to `main`.** Always work on a feature branch and open a PR.
2. **`npm run db:migrate` ALWAYS hits PRODUCTION.** It runs
   `tsx --env-file=.env src/db/migrate.ts`, and `.env` holds the **prod Supabase**
   `DATABASE_URL` (the `postgres.obt…` pooler). `.env.local` is localhost. There is
   no separate "migrate staging" command — treat every `db:migrate` as a prod write.
3. **Migrations must be idempotent.** Re-running `src/db/migrate.ts` from scratch
   must be a no-op on an already-migrated DB. Use `IF NOT EXISTS`,
   `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, guarded `ALTER`, and
   `WHERE NOT EXISTS (...)` for seeds.
4. **Never add destructive or lossy steps.** No `DROP TABLE`, no `DROP COLUMN`, no
   `TRUNCATE`, no unscoped `DELETE`/`UPDATE`. Convert data **in place** and preserve
   the existing instant/value. If you think you need a `DELETE`, see the rule below.
5. **Migrate prod BEFORE deploying code that reads the new schema.** Order is:
   apply migration to prod → verify → then let Vercel deploy the code. Never the
   reverse — the live app must never query a column that doesn't exist yet.

## The DELETE rule

`src/db/migrate.ts` runs against prod. A `DELETE` here is the single most dangerous
thing in this repo (it has wiped a feed before).

- Default answer: **don't.** Achieve the goal by converting in place
  (e.g. set `house_id = NULL` instead of deleting the row, as migration step 32 does).
- If a `DELETE` is genuinely unavoidable (e.g. de-duplication before adding a unique
  index, like step 24), it MUST be:
  - **Tightly scoped** by an explicit `WHERE` that can match only the intended rows,
  - **Self-joined to keep a survivor** (delete only the *extra* duplicates, never all),
  - Reviewed against the rule below, and called out explicitly in the PR description.
- STOP and ask the user before adding any new `DELETE`/`TRUNCATE`/`DROP` to migrate.ts.

## Workflow

### 1. Pre-flight

```bash
git rev-parse --abbrev-ref HEAD   # confirm NOT on main
git status                        # working tree state
```

If on `main`, create a feature branch first (`git switch -c <type>/<short-desc>`,
e.g. `feat/`, `fix/`, `chore/`). See the branch policy memory.

### 2. If the change touches the schema

The source of truth for the running schema is the incremental script
`src/db/migrate.ts` (NOT just `src/db/schema.ts` — Drizzle's schema defines types,
but `migrate.ts` is what has actually been applied to prod).

- Add a **new numbered step at the END** of `migrate()` in `src/db/migrate.ts`.
  Never edit or reorder earlier steps — they've already run on prod and must stay
  idempotent no-ops.
- Update `src/db/schema.ts` to match, so Drizzle types line up with the new column.
- Write a comment above the step explaining the SAFETY reasoning (idempotency +
  why it's non-destructive), matching the style of the existing steps.
- Note the Supabase transaction pooler caveat already handled at the top of the
  file: port `:6543` disables prepared statements. Don't undo that.

Self-check the new step against the Hard Rules and the DELETE rule above before
running anything.

### 2.5 Rehearse on localhost first (recommended)

Run the exact same `migrate.ts` against the local DB before touching prod. Because
the script is idempotent, this is safe to run anytime and it surfaces SQL errors
without risk. There is **no npm script** for this — `db:migrate` is hard-wired to
`.env` (prod), so invoke `tsx` directly with `.env.local`:

```bash
# The local DB is a Docker container (postgres:16-alpine) that is often stopped.
docker start activecamt-db
# Wait until it accepts connections:
until docker exec activecamt-db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

# Run the SAME migration script, but against localhost (.env.local):
npx tsx --env-file=.env.local src/db/migrate.ts
```

Gotchas learned the hard way:
- `.env` has the localhost `DATABASE_URL` **commented out**; its active line is the
  prod Supabase pooler. So `--env-file=.env` = prod. Use `--env-file=.env.local`
  (localhost, user `postgres`, db `activecamt`, port `5432`) for local.
- The container name is `activecamt-db`. It maps host `5432:5432` (a standalone
  `docker run`, NOT the `db` service in `docker-compose.yml` — that one deliberately
  does **not** expose 5432 and uses different creds). If `docker ps` doesn't list it,
  it's stopped: `docker start activecamt-db`.
- A clean run on an up-to-date DB is mostly `⚠️ already exists` NOTICEs ending in
  `✅ Migration complete!` — that means nothing changed, which is the expected result
  when the change added no new columns.

### 3. Apply the migration to PROD first

```bash
npm run db:migrate
```

- Read the full output. Every step should print `✅` (or a benign `⚠️ already
  exists`). Any `❌` means it failed — stop and fix before going further.
- This is the step that must happen **before** the code deploy, per Hard Rule 5.

### 4. Verify locally against the deployed schema (optional but preferred)

```bash
npm run build        # catches type/route errors before Vercel does
npm run lint
npm run dev          # smoke-test the path that reads the new column
```

### 5. Ship the code

```bash
git add -A
git commit -m "<message>"   # end with the Co-Authored-By trailer
git push -u origin HEAD     # feature branch, never main
gh pr create                # open PR; mention any DELETE/data-conversion in the body
```

Vercel deploys on merge (region `sin1`). Because prod is already migrated, the new
code reads a schema that exists. Done.

## Rollback note

Since migrations are additive + idempotent, a code rollback (revert the deploy)
generally does NOT require a DB rollback — the extra column/table simply goes unused.
Do **not** try to "undo" a migration by dropping the new column on prod; that's a
destructive step and violates the DELETE rule. Leave the schema; revert the code.

## Quick reference

| Thing | Value |
| --- | --- |
| Prod DB | `.env` → Supabase pooler (`postgres.obt…`), port `:6543` (localhost line is commented out) |
| Local DB | `.env.local` → localhost `:5432`, Docker container `activecamt-db` (user `postgres`, db `activecamt`) |
| Migrate prod | `npm run db:migrate` (runs `src/db/migrate.ts` against `.env`) |
| Migrate localhost | `docker start activecamt-db` then `npx tsx --env-file=.env.local src/db/migrate.ts` |
| Start local DB | `docker start activecamt-db` (it's often stopped) |
| Schema types | `src/db/schema.ts` (keep in sync with migrate.ts) |
| Deploy target | Vercel, region `sin1`, cron `/api/cron/award-points` @ 23:00 |
| Branch | feature branch only — never push to `main` |
