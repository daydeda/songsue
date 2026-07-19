---
name: db-local
description: Bring up the local Docker Postgres (songsue-db) and run/rehearse DB operations against LOCALHOST (.env.local) — migrations, seeds, studio — never prod. Use before any migration (rehearse locally first), or to get a working local DB for tests/seed data. Encapsulates the finicky local-DB dance so you never accidentally hit prod.
---

# Local DB (songsue)

Everything here targets **localhost only**. The danger this skill removes: `npm run db:migrate`
(and `db:seed`, `db:reset`) are hard-wired to `--env-file=.env`. Songsue has **no `.env`
committed to the repo** — if one exists locally it's your own, pointed at Supabase for prod
work (see `/safe-deploy`), and must never be confused with `.env.local`. To work locally you
must invoke `tsx` yourself with `.env.local`.

## The local DB
- Docker container **`songsue-db`** (`postgres:16-alpine`), host port **5433** (mapped to the
  container's internal `5432`), user `postgres`, password `postgres`, db `songsue`. It is often
  **stopped**.
- This is a standalone `docker run`, NOT the `db` service in `docker-compose.yml` (that one is
  for the superseded self-hosted deploy stack, deliberately doesn't expose a host port, and uses
  different creds — see `/safe-deploy`'s note on the Portainer plan being unused for songsue).

## Start it
```bash
docker start songsue-db
# wait until it accepts connections:
until docker exec songsue-db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
```
If `docker ps` doesn't list it at all, it may need first-time creation — ask the user; don't guess credentials.

## Rehearse a migration locally (safe, idempotent)
Run the SAME `src/db/migrate.ts` that prod runs, but against localhost:
```bash
npx tsx --env-file=.env.local src/db/migrate.ts
```
A clean run on an up-to-date DB is mostly `⚠️ already exists` notices ending in `✅ Migration complete!`. Because the script is idempotent, this is safe to run anytime and surfaces SQL errors with zero prod risk. **This is the rehearsal step `/safe-deploy` recommends before touching prod.**

## Other local ops
```bash
npx tsx --env-file=.env.local src/db/seed.ts     # seed (see seed-author; guard.ts won't trip on localhost)
npx tsx --env-file=.env.local src/db/reset.ts     # DANGER even locally — wipes the local DB; confirm intent
```

## Hard rules
- **LOCALHOST ONLY.** Never run anything here with `--env-file=.env`. If `DATABASE_URL` resolves to a `supabase.*` host or port `:6543` (the prod pooler), STOP — that's prod.
- If a local `.env` exists, treat its `DATABASE_URL` as prod (Supabase) unless you personally set it to localhost. `--env-file=.env` should never be your default here — use `.env.local`.
- `src/db/guard.ts` refuses `db:reset`/`db:seed` against remote/prod without `CONFIRM=yes` — do not work around it by pointing at prod.
- For the PROD migration path (apply for real, in order, before deploy), use `/safe-deploy`, not this skill.

## Quick reference
| Thing | Command |
| --- | --- |
| Start local DB | `docker start songsue-db` |
| Wait for ready | `until docker exec songsue-db pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done` |
| Rehearse migration | `npx tsx --env-file=.env.local src/db/migrate.ts` |
| Seed (local) | `npx tsx --env-file=.env.local src/db/seed.ts` |
| Prod migration | `npm run db:migrate` (PROD — use `/safe-deploy`) |
