<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.


# Project knowledge

This repo contains **three sibling Next.js apps** for an attendance / event / "house points" management system, plus a shared `.agents/` types directory.

| Folder | Purpose |
|---|---|
| `activecamt/` | Primary Next.js 16 web app (App Router) — admin + student dashboards, QR-based attendance scanner. |

## Stack (all three apps)

- **Framework:** Next.js 16.2.4 (App Router) + React 19.2 + TypeScript 5
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **Auth:** NextAuth v5 (beta) with `@auth/drizzle-adapter` (Google provider; see `src/auth.ts`)
- **DB:** Postgres via `postgres` driver + Drizzle ORM (`drizzle-orm` 0.45, `drizzle-kit` 0.31)
- **Forms / validation:** `react-hook-form` + `zod` v4 + `@hookform/resolvers`
- **QR:** `html5-qrcode` (scanner) + `qrcode.react` (display)
- **i18n:** Custom lightweight context in `src/lib/i18n.ts` + `LanguageContext.tsx` + `LanguageWrapper.tsx`.

## Quickstart

Run all commands from inside the specific app folder (e.g. `cd activecamt-withAI`).

```bash
# Install
npm install

# Dev server
npm run dev          # http://localhost:3000

# Build / start
npm run build
npm run start

# Lint
npm run lint
```

### Database (Drizzle, Postgres)

Requires `DATABASE_URL` in `.env`. Schema lives at `src/db/schema.ts`, generated migrations in `drizzle/`.

```bash
npm run db:push       # push schema to DB (no migration files)
npm run db:generate   # generate migration SQL from schema
npm run db:migrate    # run migrations (uses tsx + .env)
npm run db:seed       # seed data
npm run db:reset      # reset DB
npm run db:studio     # Drizzle Studio UI
```

Helper scripts:
- `elevate-admin.ts` — promote a user to admin
- `test-db.ts` — DB sanity check
- `scratch/` — one-off maintenance scripts (`check_event.ts`, `fix_qr_tokens.ts`, `fix_times.ts`, `manual_migrate.ts`, `revert_event.ts`, etc.)

Run any of these with: `npx tsx --env-file=.env <file>.ts`.

### Mobile (`activecamtMobile/` only)

Capacitor wraps the Next dev server. `capacitor.config.ts` points `server.url` at `http://localhost:3000` (update to your LAN IP for device testing).

```bash
npm run build:mobile   # next build + cap sync
npm run cap:sync
npm run open:android   # opens Android Studio
npm run open:ios       # opens Xcode (macOS only)
npm run mobile:dev     # next dev + native run
```

Requires Android Studio (Android) or Xcode + CocoaPods (iOS).

## Architecture

Standard Next.js App Router layout, parallel across all three apps:

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    onboarding/             # first-time user setup
    dashboard/              # student-facing pages
      profile/  history/  houses/
    admin/                  # admin-only pages
      dashboard/  events/  students/  scanner/  activity/  audit-logs/
      layout.tsx
    api/                    # route handlers (REST-style)
      auth/[...nextauth]/route.ts
      admin/{events,students,users,houses,scan,activity,audit-logs,dashboard}/...
      events/[id]/register/route.ts
      houses/{activity}/route.ts
      profile/{history}/route.ts
      upload/route.ts       # file uploads -> public/uploads/
  auth.ts                   # NextAuth config (Google + Drizzle adapter)
  proxy.ts                  # API proxy helpers
  components/
    admin/  home/  layout/  providers/  ui/
    providers.tsx           # top-level client providers wrapper
  db/
    schema.ts  index.ts  migrate.ts  seed.ts  reset.ts  promote-admin.ts
  lib/
    i18n.ts  LanguageContext.tsx  LanguageWrapper.tsx  rich-text.ts
  types/
    next-auth.d.ts          # session/user type augmentation
```

Domain concepts (visible from API routes & schema):
- **Users / Students** — onboarding flow, profile history, admin user management
- **Events** — registration, attendance, per-event reports
- **Houses** — points system with activity feed
- **Scanner** — admin QR scanner posts to `/api/admin/scan` to record attendance
- **Audit logs** — admin-visible activity log

Uploads go to `public/uploads/` via `/api/upload`.

## Conventions

- **TypeScript:** strict mode, ESM, `@/*` path alias to `src/*` (see each `tsconfig.json`).
- **Linting:** ESLint flat config (`eslint.config.mjs`) extending `eslint-config-next`. Run `npm run lint`.
- **Tailwind v4:** configured via `postcss.config.mjs` + `@tailwindcss/postcss`. No `tailwind.config.js` — use `@theme` / CSS-first config in `globals.css` if customizing.
- **Auth-protected routes:** server components/route handlers should use the helpers in `src/auth.ts`. Admin routes additionally check role (see existing `app/api/admin/**/route.ts` patterns).
- **DB access:** always import the configured client from `src/db/index.ts`; don't create new `postgres()` instances per call.
- **Schema changes:** edit `src/db/schema.ts`, then `npm run db:generate` to produce a migration in `drizzle/`, then `npm run db:migrate`.
- **Forms:** prefer `react-hook-form` + Zod resolver; mirror existing patterns in admin pages.
- **Three-app parallelism:** when fixing a bug or adding a feature, check whether the same change is needed in `activecamt`, `activecamt-withAI`, and `activecamtMobile` (their `src/` trees are nearly identical).

## Gotchas

- **Next.js 16 is new.** It has breaking changes vs. 14/15 (route handler signatures, async `params`/`searchParams`, caching defaults). When in doubt, consult `node_modules/next/dist/docs/` inside the relevant app folder before refactoring App Router code.
- **NextAuth v5 is beta.** API differs from v4 — use `auth()` (from `src/auth.ts`) instead of `getServerSession`. Session/user type extensions live in `src/types/next-auth.d.ts`.
- **Zod v4** is used (not v3). Some APIs (e.g. error formatting) differ; `zod-validation-error/v4` is the matching helper entry point.
- **Drizzle dialect = `postgresql`.** `DATABASE_URL` must be a Postgres connection string. Drizzle Kit reads it from `.env` via the config file.
- **Capacitor `server.url`** in `activecamtMobile/capacitor.config.ts` is hardcoded to `http://localhost:3000` with `cleartext: true`. For real-device testing, change it to your machine's LAN IP. The custom `overrideUserAgent` is intentional — Google OAuth rejects the default WebView UA.
- **Windows shell.** This workspace is on Windows; terminal commands here use `cmd`/bash conventions appropriately (`type` instead of `cat`, `dir` instead of `ls`, `\` path separators). Most npm scripts work cross-platform.
- **`scratch/`** scripts are one-off operational tools — review carefully before running; some mutate production-ish data (`fix_qr_tokens.ts`, `revert_event.ts`).
- **`public/uploads/`** is committed and contains real uploaded images. Don't delete entries casually.
- **No test framework is configured** in any of the three apps. There are no unit/integration tests yet.

<!-- END:nextjs-agent-rules -->
