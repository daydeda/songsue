---
name: safe-deploy
description: Safe deploy + DB migration checklist for songsue (Next.js; Vercel + Supabase). Use before deploying any change that touches the database schema, or before deploying code that reads a new or changed column. Enforces feature branch (never main), idempotent and non-destructive migrations, and migrating prod before deploying code that reads it.
---

# Safe Deploy (songsue)

A guided checklist to ship a change without breaking prod. The shared parent codebase
(ActiveCAMT) has been bitten before: a `DELETE` step once wiped a whole activity feed,
and code that read a new column was deployed before the column existed in prod. This
skill exists to make both impossible to repeat in songsue.

## Prod target: Vercel + Supabase

Decision: 2026-07-19 (see `docs/songsue-deploy.md`). Songsue has its **own** Supabase
project and Vercel project — separate from `smocamt-website`/ActiveCAMT's self-hosted
Portainer deploy, which this repo does not touch and this skill does not cover.

`npm run db:migrate` runs `tsx --env-file=.env src/db/migrate.ts`. There is **no `.env`
committed to this repo** — create a local, gitignored `.env` pointing `DATABASE_URL` at
songsue's Supabase **transaction pooler** connection string (port `6543`) before running
it. `src/db/index.ts` auto-detects `:6543` and disables prepared statements / lowers pool
size accordingly.

`src/db/guard.ts` refuses `db:reset`/`db:seed`/promote-admin scripts against anything
that looks remote (`supabase.co`, `:6543`, or otherwise not localhost) unless
`CONFIRM=yes` is set. Only add `CONFIRM=yes` once you're sure `.env`'s `DATABASE_URL`
is pointed at the right project.

## Hard rules (never violate)

1. **Never push to `main`.** Always work on a feature branch and open a PR.
2. **`npm run db:migrate` writes whatever your local `.env` points at.** Treat every
   `db:migrate` run as a prod write once `.env` is pointed at Supabase. Use
   `--env-file=.env.local` (localhost) for local rehearsal instead — see `/db-local`.
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
thing in this codebase (it has wiped a feed before, on the parent ActiveCAMT app).

- Default answer: **don't.** Achieve the goal by converting in place
  (e.g. set `house_id = NULL` instead of deleting the row).
- If a `DELETE` is genuinely unavoidable (e.g. de-duplication before adding a unique
  index), it MUST be:
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
e.g. `feat/`, `fix/`, `chore/`).

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

Self-check the new step against the Hard Rules and the DELETE rule above before
running anything.

### 2.5 Rehearse on localhost first (recommended)

Run the exact same `migrate.ts` against the local DB before touching prod. Because
the script is idempotent, this is safe to run anytime and it surfaces SQL errors
without risk. See `/db-local` for starting the local DB container; then:

```bash
npx tsx --env-file=.env.local src/db/migrate.ts
```

A clean run on an up-to-date DB is mostly `⚠️ already exists` NOTICEs ending in
`✅ Migration complete!` — that means nothing changed, which is the expected result
when the change added no new columns.

### 3. Apply the migration to Supabase (prod) first

Supabase is publicly reachable (a real difference from ActiveCAMT's self-hosted DB) —
run this from your own machine, with a local `.env` pointing `DATABASE_URL` at
songsue's Supabase pooler string.

```bash
npm run db:push       # only needed once, on a brand-new/empty database —
                       # bootstraps the FULL schema from src/db/schema.ts
npm run db:migrate    # layers on incremental patches from src/db/migrate.ts
```

`db:migrate` alone is not enough on a brand-new database — every step there is an
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or similar, assuming base tables already
exist. On an already-live songsue DB, `db:push` is not part of the normal flow —
just run `db:migrate`. Read the full output; every step should print `✅` (or a
benign `⚠️ already exists`). Any `❌` means it failed — stop and fix before going
further. This is the step that must happen **before** the code deploy, per Hard Rule 5.

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

Vercel auto-deploys on merge to `main` via its native GitHub integration. Because
prod is already migrated (step 3), the new code reads a schema that exists.

Done.

## Rollback note

Since migrations are additive + idempotent, a code rollback (revert the deploy or
redeploy a previous Vercel deployment) generally does NOT require a DB rollback —
the extra column/table simply goes unused. Do **not** try to "undo" a migration by
dropping the new column on prod; that's a destructive step and violates the DELETE
rule. Leave the schema; revert the code.

## Quick reference

| Thing | Value |
| --- | --- |
| Prod target | **Vercel + Supabase** (songsue's own project — see `docs/songsue-deploy.md`) |
| Migrate prod | Point a local, uncommitted `.env` at Supabase's pooler `DATABASE_URL`, then `npm run db:migrate` (brand-new DB: `npm run db:push` first) |
| Local DB | `.env.local` → localhost `:5433`, db `songsue`. See `/db-local`. |
| Migrate localhost | `npx tsx --env-file=.env.local src/db/migrate.ts` |
| Schema types | `src/db/schema.ts` (keep in sync with migrate.ts) |
| Branch | feature branch only — never push to `main` |
| Not covered here | `smocamt-website`/ActiveCAMT's separate self-hosted Portainer deploy — different repo, different remote, untouched by anything in this file |
