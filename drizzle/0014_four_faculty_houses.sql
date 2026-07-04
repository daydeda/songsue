-- 0014: Single-faculty (CAMT) → 4-faculty house model.
--
-- The column + index DDL (houses.faculty, houses.color_group, users.faculty,
-- idx_houses_color_group, idx_houses_faculty) is emitted by drizzle-kit in
-- 0007_redundant_maverick.sql. THIS file carries only the DATA migration
-- (backfill of existing rows, insert of the 12 new faculty houses, user
-- backfill + house-pointer reset).
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this
-- file mirrors steps 44–47 for parity with the drizzle/ migration history.
-- Apply ONE of them, not both. Every statement is idempotent so a second run
-- is a no-op. NON-DESTRUCTIVE: no DROP/DELETE/TRUNCATE; score_history (house
-- point history) is untouched — only users.house_id (the per-user current-house
-- pointer) is cleared so everyone re-derives their house at next check-in.

-- 44. Backfill the 4 EXISTING CAMT house rows. Their ids ('red'/'green'/
-- 'yellow'/'blue') MUST stay unchanged — users.house_id and score_history.house_id
-- already reference them. Set faculty='CAMT' and color_group = id.
UPDATE houses
SET faculty = 'CAMT', color_group = id
WHERE id IN ('red', 'green', 'yellow', 'blue');--> statement-breakpoint

-- 45. Insert the 12 new faculty houses (MASSCOM/ARCH/ARTS × red/green/yellow/blue).
-- ids/names/colours mirror src/lib/faculties.ts (ALL_HOUSE_ROWS / houseRowId / COLORS).
-- ON CONFLICT (id) DO NOTHING makes re-runs a no-op and never clobbers points.
INSERT INTO houses (id, name, color, points, faculty, color_group) VALUES
  ('masscom-red',    'Mom',   '#ef4444', 0, 'MASSCOM', 'red'),
  ('masscom-green',  'To',    '#94a3b8', 0, 'MASSCOM', 'green'),
  ('masscom-yellow', 'Luang', '#3b82f6', 0, 'MASSCOM', 'yellow'),
  ('masscom-blue',   'Makon', '#22c55e', 0, 'MASSCOM', 'blue'),
  ('arch-red',       'Mom',   '#ef4444', 0, 'ARCH',    'red'),
  ('arch-green',     'To',    '#94a3b8', 0, 'ARCH',    'green'),
  ('arch-yellow',    'Luang', '#3b82f6', 0, 'ARCH',    'yellow'),
  ('arch-blue',      'Makon', '#22c55e', 0, 'ARCH',    'blue'),
  ('arts-red',       'Mom',   '#ef4444', 0, 'ARTS',    'red'),
  ('arts-green',     'To',    '#94a3b8', 0, 'ARTS',    'green'),
  ('arts-yellow',    'Luang', '#3b82f6', 0, 'ARTS',    'yellow'),
  ('arts-blue',      'Makon', '#22c55e', 0, 'ARTS',    'blue')
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint

-- 46. Backfill users.faculty for legacy rows (all existing students are CAMT).
UPDATE users SET faculty = 'CAMT' WHERE faculty IS NULL;--> statement-breakpoint

-- 47. Reset the per-user current-house pointer so everyone re-derives their house
-- (now faculty-scoped) at next check-in. Intentional + non-destructive: house
-- point history in score_history is preserved; only users.house_id is cleared.
UPDATE users SET house_id = NULL;
