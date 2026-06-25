# Co-project — Design Spec

> Status: **DRAFT for review.** Nothing will be built until explicitly triggered ("call the Co-project"). This document is the agreed design; treat it as the source of truth when implementation starts.

## Context

We will run a **one-day collaborative event ("co-project") across 4 faculties**. It must reuse the existing house structure as teams and *feel* the same to score, but it must be **completely walled off from the main competition** — it can never change the real house standings (`houses.points`) or the real individual standings (`users.points`) shown on activecamt.cmu.ac.th.

The current scoring system has exactly **three paths** that move the real scores, and all three live in shared, load-bearing code:
1. **Winner-bonus cron** (`src/lib/award-points.ts`) — at event end, the house with the most attendees gets `events.pointsAwarded`.
2. **Milestone bonus** (`src/modules/events/scanner.service.ts`) — when a student's points cross a 100-mark, their house gets +2.
3. **Scanner individual award** — staff scan → `users.points` is updated.

Threading "skip if co-project" conditionals through those paths is exactly the kind of change that caused past regressions (the 5-PR scanner loop). So we deliberately **do not touch them**.

## Decisions (locked)

| Question | Decision |
|---|---|
| Isolation | **Separate sandbox** — co-project gets its own tables, its own admin section, and its own scan page. The main scanner/cron/leaderboard code is left untouched, so it *physically cannot* move the real scores. |
| Teams | **Reuse the same 4 houses** (Mom/To/Luang/Makon) as team labels only — `houses` is read **read-only** by co-project code. |
| House assignment | Each participant gets a **balanced-random house**, scoped to the co-project. Their real `users.houseId` is **never** touched. |
| Scoreboard | **Both** a house ranking **and** an individual ranking, isolated from the main boards. |
| Scoring mechanism | Same QR-scan UX. **Two independent actions:** (a) scan a student → award **individual** co-project points; (b) staff award points **directly to a house** (separate from individuals, like the main winner bonus). No milestone cross-bonus. |

## Isolation guarantee (the #1 requirement)

The change is **purely additive — new tables only**. It adds **no columns** to `events`, `users`, `houses`, `attendance`, or `scoreHistory`.

- `users.points` and `houses.points` are **never written** by any co-project code path.
- The winner-bonus cron, the forms logic, the main scanner, and the main leaderboard are **unchanged** — they have no reference to the co-project tables, so they cannot read or write them.
- `houses` is read-only for the co-project (only to display team name + color).
- The migration is **CREATE TABLE only** — non-destructive, idempotent, safe to run on prod.

This means: even in the worst case of a co-project bug, the main standings are mathematically untouchable.

## Data model — new tables (sandbox)

1. **`coProjects`** — the event itself (kept separate from `events`).
   - `id`, `title`, `description?`, `location?`, `startTime`, `endTime`, `isActive` (which co-project the scanner is live for), `createdAt`, `updatedAt`.

2. **`coProjectParticipants`** — a student's enrolment + random house for this co-project.
   - `id`, `coProjectId` → coProjects, `studentId` → users, `houseId` → houses (the balanced-random team), `faculty?` (one of the 4, optional — for headcount/reporting only), `points` (denormalized individual total, for fast sorting), `checkedInAt?`, `createdAt`.
   - Unique on `(coProjectId, studentId)`.

3. **`coProjectScoreHistory`** — append-only ledger (audit + activity feed) for both award kinds.
   - `id`, `coProjectId`, `kind` (`'individual'` | `'house'`), `houseId?`, `studentId?`, `delta`, `reason`, `actorId`, `timestamp`.

- **Individual board** = `coProjectParticipants` ordered by `points DESC` (denormalized; updated atomically with each award).
- **House board** = live `SUM(delta)` over `coProjectScoreHistory WHERE kind='house'` grouped by `houseId` (only 4 houses — trivially cheap; the ledger is the source of truth).

## Scoring flows

**Check-in / enrolment (first scan):**
- Scan student QR → `verifyQrToken()` returns the studentId (existing tokens identify the student only — no event baked in, so they work as-is).
- If not yet a participant → create `coProjectParticipant` with a **balanced-random house** (a new `pickBalancedCoProjectHouseId(coProjectId)`, mirroring the existing `HousesService.pickBalancedHouseId()` but counting *co-project* members per house). Optionally capture faculty. Sets `checkedInAt`.

**Individual award (scan mode):** enter points + reason → atomically `coProjectParticipants.points += delta` and insert a `kind='individual'` ledger row. (Never touches `users.points`.)

**House award (direct):** staff pick a house + points + reason → insert a `kind='house'` ledger row. (Never touches `houses.points`.)

## Surfaces to build (all new, none shared)

- **DB:** new tables in `src/db/schema.ts` + generated migration (via the `drizzle-migration-author` agent; `db:generate` only — never `db:migrate`).
- **Service:** `src/modules/co-project/co-project.service.ts` — enrolment, balanced assignment, individual award, house award, leaderboards. (Modeled on `houses.service.ts` / `scanner.service.ts`, but writing only to co-project tables.)
- **Admin scan page:** `src/app/admin/co-project/scanner/` + `POST /api/admin/co-project/scan` (separate from `/api/admin/scan`). Reuses the scanner UI patterns.
- **Admin management:** `src/app/admin/co-project/` — create/edit the co-project, set it active, view participants + assigned house + faculty, manual house reassignment, view boards, CSV export.
- **Public/student leaderboard:** `src/app/co-project/` with House + Individual tabs (template: `src/app/dashboard/houses/page.tsx`), backed by `GET /api/co-project/leaderboard` and `GET /api/co-project/individual`.
- **i18n:** add co-project keys across **en / th / mm / cn** in `src/lib/i18n.ts`.

## Access control — must move together (4 layers)

Per CLAUDE.md, `src/proxy.ts` runs first and is easy to miss. New `/admin/co-project/**` routes must be added to:
1. `src/proxy.ts` (edge gate),
2. `src/lib/admin-access.ts` predicates,
3. the admin layout / nav,
4. each route handler's server-side role gate (the real source of truth).

**Open decision — who may run the co-project scanner?** Reuse the `canGiveIndividualScore` roles (super_admin, admin, registration, organizer, smo)? Note `smo` is currently confined to `/admin/scanner`; if smo should scan the co-project too, proxy must also allow `/admin/co-project/scanner` for smo. *To confirm at build time.*

## PDPA note

The co-project scanner will **not read or display medical data**, so it adds no new sensitive-data exposure and needs no medical audit path. (Many participants are from other faculties and won't have onboarded anyway.) House/individual awards are still written to the co-project audit ledger (`coProjectScoreHistory.actorId`).

## Open items to confirm before/at build

1. **Faculty capture** — do we record each participant's faculty (one of the 4) at check-in for headcount, or skip it? (Currently planned as optional.)
2. **House board = direct awards only** (no roll-up of individual points). Confirm — or do you want house score to also include members' individual points?
3. **Scanner roles** — see access-control note above.
4. **Single vs multiple co-projects** — modeled as a table (future-proof), with one `isActive` at a time. OK?

## Verification plan (when built)

- `npm run lint` + `npm run build`.
- Rehearse migration on the **local** Docker DB (`/db-local`), never prod; confirm it is CREATE-TABLE-only.
- Seed a co-project + fake participants (via `seed-author`, local only).
- `/verify` end-to-end: scan a student → confirms balanced house assignment; individual award moves only the individual board; house award moves only the house board.
- **Isolation proof:** snapshot `houses.points` and `users.points` before and after a full co-project run — assert they are **identical**.
- Run `/recheck` and `/safe-deploy` before any deploy; migrate prod before deploying code that reads the new tables.
