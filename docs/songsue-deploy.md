# Deploy Runbook: Songsue → Vercel + Supabase

Stands up a standalone production deployment of this repo (`daydeda/songsue`) on
**Vercel**, backed by a dedicated **Supabase** project for Postgres + file
storage — separate from and non-impacting to the existing
`activecamt.camt.cmu.ac.th` production stack (`daydeda/smocamt-website` — a
different repo, deployed and managed independently of this one).

**Superseded plan:** an earlier version of this doc described a self-hosted
Docker Swarm deploy to CAMT's `dev2` Portainer instance. That path was dropped
in favor of Vercel + Supabase (decision: 2026-07-19) — mainly because it
avoids the IT-mediated port/hostname routing step that was blocking the
Portainer plan from going live. `docker-stack.songsue.yml` and
`.github/workflows/docker-publish.yml` still exist in the repo but are unused
by this deploy target; see git history for the old runbook if a self-hosted
path is ever needed again.

The codebase needed **zero code changes** for this — it already had Supabase
Storage code paths (`src/app/api/upload/route.ts`,
`src/lib/form-file-storage.ts`, `src/lib/shop-storage.ts`), pooler-aware DB
connection handling (`src/db/index.ts`), and a `vercel.json` with cron config,
all inherited from the ActiveCAMT parent project.

---

## 0. Domain

Vercel gives you `<project>.vercel.app` immediately on import — nothing to
request, nothing IT-mediated. Ship on that first.

Optional custom domain later (e.g. `songsue.camt.cmu.ac.th` or
`songsue.cmu.ac.th`): Vercel dashboard → your project → **Domains** → add
domain → Vercel gives you a CNAME/A record → ask CAMT IT to add that DNS
record. Much lighter than the old Portainer plan's port-range + reverse-proxy
dance — no port allocation, no "one stack per project" constraint. Not
required to go live.

## 1. OAuth — reusing activecamt's Google client

Reuse the existing Google OAuth client; songsue has **no `@cmu.ac.th`-only
restriction** (any Google account can sign in).

- **Code-level:** `src/auth.ts`'s `signIn` callback has no `@cmu.ac.th` domain
  check — already the app's current behavior, zero code changes needed.
- **Google Cloud side:** OAuth client's **Credentials** page → add your Vercel
  domain's **Authorized redirect URI**
  (`https://<your-domain>/api/auth/callback/google`, e.g.
  `https://songsue.vercel.app/api/auth/callback/google`) and **Authorized
  JavaScript origin** (`https://<your-domain>`) alongside activecamt's
  existing ones — one client, multiple redirect URIs, no cross-effect. Copy
  the same `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` values into songsue's
  Vercel env vars. Add a second URI/origin later if you add a custom domain.
- **Worth separately confirming:** OAuth consent screen's **User type**. If
  it's **Internal** (tied to the CMU Workspace org), Google blocks
  non-`@cmu.ac.th` accounts before the app's code ever runs, regardless of
  what the code allows — switching to **External** (affects activecamt too)
  or a dedicated client would be needed for genuinely open sign-in. If it's
  already **External**, nothing further to do.

## 2. Create the Supabase project

- New project in the Supabase dashboard. Pick a region close to users —
  Singapore matches `vercel.json`'s `regions: ["sin1"]`.
- **Project Settings → Database → Connection string**: use the **Transaction
  pooler** (port `6543`), not the direct connection — Vercel functions are
  short-lived/high-concurrency and need pooled connections. This becomes
  `DATABASE_URL`. `src/db/index.ts` already auto-detects `:6543` in the URL
  and disables prepared statements / lowers pool size accordingly — no config
  needed on the app side.
- **Project Settings → API**: copy the **Project URL** (`SUPABASE_URL`) and
  the **`service_role`** secret key (`SUPABASE_SERVICE_ROLE_KEY` — server-side
  only, never expose client-side).

## 3. Create the storage buckets

Supabase dashboard → **Storage** → **New bucket**, create exactly these three
(names are hardcoded in the code, must match exactly):

| Bucket | Public? | Used by |
| --- | --- | --- |
| `uploads` | **Public** | `src/app/api/upload/route.ts` — event/house images |
| `form-uploads` | **Private** | `src/lib/form-file-storage.ts` — evaluation-form file answers (PDPA) |
| `slips` | **Private** | `src/lib/shop-storage.ts` — payment slips (PDPA) |

Without `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` set, all three fall back to
writing local disk — which does **not** work on Vercel's ephemeral/read-only
filesystem. Both env vars must be set before any upload flow is exercised.

## 4. Create the Vercel project

- Vercel dashboard → **New Project** → import `daydeda/songsue`. Framework
  preset auto-detects as Next.js; no build command changes needed.
- **Environment Variables** (Production — and Preview if you want PR previews
  to work against the same DB, though a separate Supabase project per
  environment is safer once this is more than one person's project):
  - `DATABASE_URL` — Supabase pooler string from step 2.
  - `AUTH_URL` — `https://<your-domain>` (production fails fast without this —
    `src/auth.ts` line ~26 — since `trustHost: true` otherwise derives the
    OAuth callback host from the request `Host` header).
  - `AUTH_SECRET` — new, `openssl rand -base64 33`. Must **not** reuse
    activecamt's — it signs sessions; sharing it would let a songsue session
    token be replayed against activecamt or vice versa.
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — same values as activecamt's (see
    step 1).
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from step 2.
  - `SUPER_ADMIN_EMAILS` — comma-separated; see step 6.
  - `CRON_SECRET` — new, e.g. `openssl rand -hex 32`. Vercel automatically
    sends `Authorization: Bearer $CRON_SECRET` on its own scheduled cron
    invocations once this var is set — the two routes in
    `src/app/api/cron/*/route.ts` already fail closed if it's missing.
- `vercel.json` already declares `regions: ["sin1"]` and both cron schedules
  (`award-points` daily, `gc-form-files` daily) — nothing to configure in the
  dashboard's Cron Jobs UI beyond setting `CRON_SECRET` above.
- **Deploy.**

## 5. Build the schema

Supabase is publicly reachable (unlike the old self-hosted DB, which had no
public port and required a container console) — run this from your own
machine. Point a local `.env` at the Supabase `DATABASE_URL` from step 2, then
run **both**, in order:

```sh
npm run db:push       # bootstraps the FULL schema from src/db/schema.ts
npm run db:migrate    # layers on incremental patches — hardwired to --env-file=.env
```

`db:migrate` alone is not enough on a brand-new database — every step there is
an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or similar, assuming base tables
already exist. Skipping `db:push` first fails with `relation "users" does not
exist`. `db:push` may show an interactive drizzle-kit confirmation prompt; on
a truly empty DB there's nothing ambiguous to resolve.

`src/db/guard.ts` will refuse to run against a host matching
`supabase.co`/`:6543` (or anything else that looks remote) unless you pass
`CONFIRM=yes` — that's intentional protection against running a destructive
script against prod by accident, not a bug. Only add `CONFIRM=yes` once
you're sure the target is right.

## 6. Promote your admin account

Two separate mechanisms, pick one depending on the role you need — both run
from your own machine against the Supabase `DATABASE_URL` (no container
console needed, unlike the Portainer plan):

- **`admin`:** sign in once at your Vercel URL via Google, then:
  ```sh
  CONFIRM=yes npx tsx --env-file=.env elevate-admin.ts <your-email>
  ```
  (only ever sets `role: "admin"` — there's no CLI path to `super_admin`.)
- **`super_admin`:** set `SUPER_ADMIN_EMAILS` (comma-separated) as a Vercel
  env var (already set in step 4) and redeploy if you haven't already.
  `src/auth.ts` force-promotes any matching email to `super_admin` on every
  sign-in/session refresh — no script needed.

## 7. Verify before announcing

- Visit the Vercel deployment URL, sign in with a non-`@cmu.ac.th` Google
  account — confirms "no restriction" works end-to-end.
- Upload an image; confirm the stored URL is an absolute Supabase Storage URL
  (not `/uploads/...`), confirming the `uploads` bucket is wired correctly.
- Exercise a form-file-answer upload and a shop slip upload; confirm the
  private buckets accept files and are not publicly listable/guessable.
- `/audit-verify` against the Supabase DB.
- `/scanner-verify` if you intend to run real events/check-ins on songsue.
- Trigger a cron manually to confirm the secret check works:
  ```sh
  curl -i https://<your-domain>/api/cron/gc-form-files \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
  then check Vercel dashboard → **Cron Jobs** → run history after the next
  scheduled time.

## Updating later

Vercel auto-deploys on every push to `main` via its native GitHub
integration — set up automatically when you imported the repo in step 4. No
GHCR image, no Portainer webhook, no Community-vs-Business-Edition gating to
worry about (the old plan's biggest operational unknown). `main` pushes go to
Production; other branches get their own Preview deployment URL for free.

## Backups

Supabase's own backup coverage depends on your project's plan:
- **Free tier:** no automated backups (check current Supabase docs — this has
  changed over time).
- **Pro tier and up:** daily backups, with Point-in-Time Recovery available on
  higher tiers.

Check what your plan actually covers before assuming you're protected.
`scripts/backup-db.mjs` (pg_dump → gzip → Google Drive) was written for the
self-hosted Postgres path, which had no managed backups at all — it still
works fine pointed at a Supabase `DATABASE_URL` as a belt-and-suspenders extra
copy if your plan's built-in coverage isn't enough, but it's optional here in
a way it wasn't for the self-hosted plan.

## Rollback

Vercel keeps every deployment. Rolling back is dashboard → **Deployments** →
pick a previous one → **Promote to Production** — no infra teardown, no image
re-pull uncertainty. Until a custom domain points here, the `vercel.app` URL
being live is low-stakes by default (still reachable by anyone with the URL,
so don't treat it as private).
