# Deploy Runbook: Songsue → CAMT `dev2` (Portainer / Docker Swarm)

Stands up a brand-new, standalone production deployment of this repo
(`daydeda/songsue`) at **`songsue.camt.cmu.ac.th`**, separate from and
non-impacting to the existing `activecamt.camt.cmu.ac.th` production stack
(`daydeda/smocamt-website` — a different repo, deployed and managed
independently of this one). Fresh empty database — no data/storage migration
needed.

Environment constraints: shared Docker Swarm via Portainer web UI at
`dev2.camt.cmu.ac.th`, no SSH/host filesystem, no `build:` (pre-built GHCR
image only), no bind mounts (named volumes only), **one stack per project**
(per CAMT IT's own instructions — see the "วิธีเข้าใช้งาน dev2" PDF).

---

## 0. Port + hostname — resolved

CAMT IT confirmed the allowed public port range for this project is
**10700–10799**. `activecamt` already forwards `10780`, so that one's taken.
**This runbook uses `10781`** for songsue — next free port in the range, not
adjacent to anything else documented in this repo.

Before deploying, sanity-check `10781` isn't already claimed by some *other*
CAMT project's stack you can't see from this repo (Portainer → Stacks, or ask
IT to confirm) — the range being assigned to you doesn't guarantee every port
in it is actually free session-to-session. If it's taken, pick another free
one in `10700–10799` and update both `docker-stack.songsue.yml` (the
`"10781:3000"` line) and every `10781` reference below.

Hostname: still request `songsue.camt.cmu.ac.th` → `10781` reverse-proxy
routing from CAMT IT (or `songsue.cmu.ac.th` if they offer the root domain
instead — either works technically, just update `AUTH_URL` and the proxy
target to match whichever they wire up). That routing step is IT-mediated and
is the one piece that still blocks going live — everything else below can be
prepared ahead of it.

## 1. OAuth — reusing activecamt's Google client

You confirmed: reuse the existing Google OAuth client, and songsue should have
**no `@cmu.ac.th`-only restriction** (any Google account can sign in).

Two things worth knowing:
- **Code-level:** `src/auth.ts`'s `signIn` callback currently has no
  `@cmu.ac.th` domain check at all — it was disabled and later removed from
  this codebase, despite a stale comment above it still claiming to enforce
  one. So reusing the client requires **zero code changes** to get "no
  restriction" on songsue — that's already the app's current behavior.
- **Google Cloud side:** in the OAuth client's **Credentials** page, just add
  a second **Authorized redirect URI**
  (`https://songsue.camt.cmu.ac.th/api/auth/callback/google`) and **Authorized
  JavaScript origin** (`https://songsue.camt.cmu.ac.th`) alongside activecamt's
  existing ones — one client, multiple redirect URIs, no cross-effect between
  apps. Copy the same `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` values into
  songsue's Portainer stack env vars.
- **Worth separately confirming** (not required to proceed, but affects what
  "no restriction" actually means in practice): check the OAuth consent
  screen's **User type** (APIs & Services → OAuth consent screen). If it's set
  to **Internal** (tied to the CMU Google Workspace org), Google itself blocks
  non-`@cmu.ac.th` accounts before either app's code ever runs — in which case
  songsue would inherit that restriction regardless of the code, and getting a
  truly open sign-in would need either switching that client to **External**
  (affects activecamt too) or a second, dedicated OAuth client for songsue. If
  it's already **External**, nothing further to do.

## 2. Publish the image to GHCR

Already wired: `.github/workflows/docker-publish.yml` pushes
`ghcr.io/daydeda/songsue:latest` on every push to this repo's `main` (or run
it manually via *Actions → Build and publish Docker image → Run workflow*).

**The `daydeda/songsue` GitHub repo is now public** — but that's a separate
setting from the GHCR *package* visibility; making the repo public does not
automatically make `ghcr.io/daydeda/songsue` public. Check: GitHub → repo →
**Packages** (right sidebar) → the `songsue` package → **Package settings** →
confirm visibility, and if it still shows Private, **Change visibility** →
Public. (No secrets are baked into the image — `.env*` is `.dockerignore`d and
everything is injected at runtime — so this is safe either way.) If you'd
rather leave the package private, add a `ghcr.io` registry credential in
Portainer instead (username + PAT with `read:packages`) — either path works,
public just skips a credential.

## 3. Create the stack in Portainer

Following the CAMT IT instructions exactly (dev2 → primary environment →
Stacks → **+ Add Stack**):
- **Name:** `songsue` (must NOT reuse or edit the `activecamt` stack).
- **Build method: Repository**
  - **Repository URL:** `https://github.com/daydeda/songsue` ·
    **Authentication: OFF** — the repo is now public, so Portainer can pull
    the compose file with no GitHub credential. (If it ever goes private
    again, flip this back ON with a GitHub username + PAT.)
  - **Reference:** `refs/heads/main` · **Compose path:**
    `docker-stack.songsue.yml`
- **Environment variables:** (`SONGSUE_PORT` is NOT one of these — the port is
  hardcoded directly in `docker-stack.songsue.yml`, matching how activecamt's
  own stack file hardcodes `10780`)
  - `POSTGRES_PASSWORD` — new, URL-safe, distinct from activecamt's.
  - `AUTH_SECRET` — new, `openssl rand -base64 33`. Must NOT reuse
    activecamt's — it signs sessions, sharing it would let a songsue session
    token be replayed against activecamt or vice versa.
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — same values as activecamt's (see
    step 1).
- (Optional) Enable GitOps webhook + re-pull if you want merges to
  auto-deploy — see "Updating later" below.
- **Deploy the stack.**

`web` waits for `db`'s healthcheck before starting (same as activecamt).

## 4. Build the schema

*Containers → `songsue_web` → Console → `/bin/sh` → Connect*:
```sh
npm run db:migrate:container
```
This is a brand-new empty database — no data-only pg_dump step, no storage
bucket migration, unlike the activecamt cutover. Nothing else to import.

## 5. Promote your admin account

Sign in once at `https://songsue.camt.cmu.ac.th` via Google, then in the
`songsue_web` console:
```sh
CONFIRM=yes npx tsx elevate-admin.ts <your-email>
```
Note `SUPER_ADMIN_EMAILS` (if set as a stack env var) also auto-promotes on
every session refresh — same mechanism as activecamt, independent per stack
since each has its own env vars.

## 6. Verify before announcing

- Both `songsue_web` and `songsue_db` running (Portainer → Stacks → `songsue`).
- Sign in with a non-`@cmu.ac.th` Google account — confirms "no restriction"
  actually works end-to-end, not just in theory.
- Upload an image; confirm it persists across a stack redeploy (named
  volumes — same pattern as activecamt).
- `/audit-verify` against this stack's own DB.
- `/scanner-verify` if you intend to run real events/check-ins on songsue.

## 7. Cut over

- Confirm `https://songsue.camt.cmu.ac.th` resolves through the CAMT proxy to
  `10781` (IT-mediated, same as step 0).

## Updating later

**The webhook alone is NOT reliable auto-deploy on this Portainer install.**
In the stack's *Editor → GitOps updates* panel, `Re-pull image` and `Force
redeployment` are both greyed out behind a **"Business Feature"** badge — this
dev2 instance is Community Edition, which doesn't license that toggle.
Without it, firing the webhook redeploys the stack's git-defined spec but
doesn't force Swarm to actually pull a fresh `ghcr.io/daydeda/songsue:latest`
from the registry — it can end up just re-using whatever image is already
cached under that tag on the node, i.e. stale code, silently.

**Reliable path (confirmed free-tier, from the dev2 PDF):** *Stacks →
songsue → Editor → "Update the stack" → toggle "Pull latest image version"
(this one is NOT gated) → Update.* Do this by hand after every merge until/
unless you've actually verified the webhook path re-pulls in practice.

Optional, in addition (harmless, but don't rely on it alone): enable
`GitOps updates` → `Webhook` on the stack and copy its URL — must use a
**separate** webhook/secret so songsue's CI can never touch activecamt's
stack:
1. Copy the webhook URL from Portainer (the "Copy link" button next to it).
2. Add it as a GitHub repo secret on `daydeda/songsue` — name it something
   distinct like `SONGSUE_PORTAINER_WEBHOOK_URL` (not
   `PORTAINER_WEBHOOK_URL`, which is reserved for activecamt's own workflow in
   the other repo). `docker-publish.yml` doesn't call this yet; wiring the
   final "notify Portainer" step is a small follow-up if you want it, but
   given the Re-pull gating above, treat it as "redeploy the spec" only, not
   "guarantees fresh code."

## Backups (optional, deferred)

`docker-stack.songsue.yml` has the `backup` service commented out. Self-hosted
Postgres has no managed backups otherwise — when ready, uncomment it; it runs
`scripts/backup-db.mjs` once a day: `pg_dump` → gzip → upload to a Google
Drive folder (via OAuth as your own account, not a service account — service
accounts have no Drive quota of their own) → deletes the local copy (zero
server disk cost) → prunes backups older than `BACKUP_RETENTION_DAYS` (default
30).

**Fastest path — reuse activecamt's existing Drive setup:** if you already
completed the one-time OAuth setup for activecamt, you can reuse the same
`GDRIVE_OAUTH_CLIENT_ID` / `GDRIVE_OAUTH_CLIENT_SECRET` /
`GDRIVE_OAUTH_REFRESH_TOKEN` values in songsue's stack env vars — just point
`GDRIVE_FOLDER_ID` at a **different** Drive folder so the two apps' backups
don't land in the same place. No new OAuth client or refresh token needed.

**Or set up a dedicated one (one-time):**
1. In any Google Cloud project (free, no billing required): **APIs & Services
   → Library** → enable the **Google Drive API**.
2. **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**.
   Application type: **Desktop app**. Copy the **Client ID** and **Client
   Secret**.
3. In Google Drive, create a folder for songsue's backups. Copy its id from
   the URL (`drive.google.com/drive/folders/<FOLDER_ID>`).
4. On your own machine — **in your own terminal, not through an AI
   assistant/chat**, since it prints a live credential:
   ```sh
   GDRIVE_OAUTH_CLIENT_ID=... GDRIVE_OAUTH_CLIENT_SECRET=... node scripts/gdrive-get-refresh-token.mjs
   ```
   Approve the browser consent screen; it prints a **refresh token**.
5. Set `GDRIVE_OAUTH_CLIENT_ID`, `GDRIVE_OAUTH_CLIENT_SECRET`,
   `GDRIVE_OAUTH_REFRESH_TOKEN` (from step 4), `GDRIVE_FOLDER_ID` (from step
   3) as songsue's stack env vars, uncomment the `backup` service, redeploy.

**Manual fallback** (e.g. before a risky migration): from the `songsue_web`
console, `node scripts/backup-db.mjs` runs one immediately using the same env
vars.

## Rollback

Until DNS points at CAMT (step 7), nothing is public yet — rollback is "don't
finish step 7." Nothing here touches activecamt's stack, database, or GHCR
image at any point.
