# Cutover Runbook: Supabase/Vercel → CAMT `dev2` (Portainer / Docker Swarm)

Moves ActiveCAMT off Vercel + Supabase (managed Postgres + Storage) onto the CAMT
server at **`dev2.camt.cmu.ac.th`**, which is a **shared Docker Swarm managed via
Portainer** (web UI). Key constraints of this environment:

- **No SSH, no host filesystem.** You deploy by pasting a stack YAML into the web
  editor and run commands via the per-container **Console (exec)**.
- **No `build:`.** Portainer deploys a **pre-built image** — we publish it to GHCR.
- **No bind mounts.** Persistence is via **named volumes**.
- **One stack per project** (shared resources).

Supabase does two jobs today — the **database** and **file storage** (3 buckets) —
both must be migrated. Assigned: public port **10780**, hostname
**`activecamt.camt.cmu.ac.th`**.

> Follows `/safe-deploy` rules: feature branch, idempotent + non-destructive steps.

---

## 0. One-time setup
- **Log in:** https://dev2.camt.cmu.ac.th → *Use internal authentication* →
  `camtplaybase` / your password. **Rotate the password** immediately.
- **Google OAuth:** add redirect URI
  `https://activecamt.camt.cmu.ac.th/api/auth/callback/google` and origin
  `https://activecamt.camt.cmu.ac.th`.
- **Maintenance window:** put the live Vercel site in read-only so no new
  rows/uploads land on Supabase after you snapshot it.

## 1. Publish the image to GHCR
The `.github/workflows/docker-publish.yml` workflow builds from the `Dockerfile`
and pushes `ghcr.io/daydeda/smocamt-website:latest` on every push to `main`
(or run it manually via *Actions → Build and publish Docker image → Run workflow*).

Because the repo is **private**, the GHCR package defaults to private. Either:
- **Make the package public:** GitHub → repo → Packages → the package → Settings →
  Change visibility → Public. (The image holds no secrets — `.env*` is in
  `.dockerignore` and all secrets are injected at runtime.) Simplest. **— or —**
- **Keep it private** and in Portainer: *Registries → Add registry → Custom*,
  URL `ghcr.io`, username = your GitHub login, password = a PAT with `read:packages`.

## 2. Deploy the stack in Portainer (Repository / GitOps method)
*Stacks → + Add Stack*, name it `activecamt`, **Build method: Repository**:
- **Repository URL:** `https://github.com/daydeda/smocamt-website` ·
  **Authentication: ON** → GitHub username + a PAT (repo is private).
- **Reference:** `refs/heads/main` · **Compose path:** `docker-stack.yml`
- **Environment variables** (the `${...}` placeholders in the compose — secrets
  live here, never in git): `POSTGRES_PASSWORD` (URL-safe chars),
  `AUTH_SECRET` (`openssl rand -base64 33`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
- Enable **GitOps updates → Webhook** and **Re-pull image** (this is what makes
  merges to `main` auto-deploy — see "Updating later"). → **Deploy the stack**.

`web` waits for `db` to pass its healthcheck (`depends_on` is honored under
`docker compose`) before starting.

## 3. Build the schema
*Containers → `activecamt_web` → Console → `/bin/sh` → Connect*, then:
```sh
npm run db:migrate:container     # reads DATABASE_URL from the container env (no .env file)
```

## 4. Migrate the database (data only)
The schema now exists, so import **data only**. The `web` container can reach both
Supabase (internet) and `db`, so do it in one pipe from inside it. In the web
console:
```sh
apk add --no-cache postgresql-client   # node:alpine has no pg tools; ephemeral, fine

pg_dump "postgresql://postgres:[PW]@db.[ref].supabase.co:5432/postgres?sslmode=require" \
  --data-only --schema=public --no-owner --no-privileges --disable-triggers \
| psql "$DATABASE_URL"
```
- Use the Supabase **direct** connection (port `5432`), not the `6543` pooler.
- Data-only dumps include `setval()` so sequences stay correct; `--disable-triggers`
  loads rows regardless of FK order.
- Do **not** run `db:seed` afterward — the data is already there. (If you ever do
  need seed/elevate, they're guarded: `NODE_ENV=production` makes them refuse
  unless you prefix `CONFIRM=yes` — see `src/db/guard.ts`.)

## 5. Migrate the storage buckets
There's no host path to copy files onto, so pull them straight from Supabase into
the volumes. In the web console, with the Supabase creds passed inline (they are
deliberately NOT in the stack env):
```sh
SUPABASE_URL=https://[ref].supabase.co \
SUPABASE_SERVICE_ROLE_KEY=[service_role_key] \
node scripts/migrate-supabase-files.mjs
```
This downloads `uploads` → `public/uploads/`, `form-uploads` →
`.uploads-private/form-uploads/`, `slips` → `.uploads-private/slips/` (all on the
named volumes). Safe to re-run; existing files are skipped.

## 6. Rewrite public image URLs in the DB
DB rows hold absolute `…supabase.co/storage/v1/object/public/uploads/<file>` URLs;
on disk they serve from `/uploads/<file>`. In the web console:
```sh
node scripts/rewrite-storage-urls.mjs
```
Idempotent, and it **refuses to run against a Supabase DB**. Private files (slips,
form docs) are referenced by key, not URL — no rewrite needed.

## 7. Promote your admin account
Sign in once at `https://activecamt.camt.cmu.ac.th` via Google, then in the web
console (note the `CONFIRM=yes` — `guard.ts` blocks privileged scripts under
`NODE_ENV=production`):
```sh
CONFIRM=yes npx tsx elevate-admin.ts you@cmu.ac.th
```

## 8. Verify before announcing
- Both services running (Portainer → Stacks → your stack).
- Sign in; posters, shop images, and the payment QR render (URL rewrite worked).
- Upload a new image + a new payment slip; confirm they persist across a stack
  redeploy (named volumes).
- Open a record with a slip / form upload as an admin — confirm it loads.
- `/audit-verify` — `audit_logs` + `users` moved, chain must still verify.
- `/scanner-verify` — re-test QR scan + medical-gating-by-role.

## 9. Cut over & decommission
- Confirm `https://activecamt.camt.cmu.ac.th` resolves through the CAMT proxy to
  port 10780 (request from IT if not already wired).
- Keep the Supabase project **read-only for a grace period** as a rollback path
  before deleting it.

## Updating later (automatic)
Once set up, it's hands-off: **merge to `main` → GitHub Actions builds + pushes
the image → calls the Portainer webhook → Portainer re-pulls the image and
redeploys.** One-time wiring:
1. After deploying (step 2) with the webhook enabled, copy the stack's **webhook
   URL** from Portainer.
2. Add it as a GitHub **repo secret** named `PORTAINER_WEBHOOK_URL`
   (Settings → Secrets and variables → Actions). The workflow's final step calls
   it; until the secret exists that step safely no-ops.

Manual fallback (e.g. webhook misconfigured): *Stacks → activecamt → Editor →
Update the stack → enable "Pull latest image version" → Update*.

## Backups (your responsibility now)
Self-hosted Postgres has no managed backups. Periodically, from the `db` container
console: `pg_dump -U activecamtuser activecamtdb > /tmp/backup.sql` and copy it off the
server (e.g. `docker cp` is unavailable without host access — instead pipe to a
download, or run `pg_dump` from the web container to an off-site target). Schedule
this before each migration at minimum.

## Rollback
Until DNS points at CAMT (step 9), the live site is still Vercel+Supabase —
rollback is "do nothing." This runbook only reads from Supabase and writes to the
new DB, so Supabase data/storage stay intact for repointing back if needed.
```
