-- 0022: Revert the four-faculty-houses model (drizzle/0020, 0021). ActiveCAMT
-- is CAMT-only — MASSCOM/ARCH/ARTS were prep work for a separate project
-- (Songsue) that landed here by mistake (commit 92af6c7 says so explicitly:
-- "Prep work for the Songsue fork"). src/lib/faculties.ts is already reverted
-- to CAMT-only in code; this removes the 12 orphan faculty house rows the
-- 0021 data migration inserted (masscom-*, arch-*, arts-*).
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this
-- file mirrors step 66 for parity with the drizzle/ migration history.
-- Apply ONE of them, not both.
--
-- NON-DESTRUCTIVE guard: only deletes a house row if nothing references it.
-- users.house_id has no cascade (a real reference would abort the whole
-- statement), and score_history.house_id CASCADEs on delete (a real reference
-- would silently wipe that house's point history) — so both are checked
-- explicitly before any row is removed. In the live system this should always
-- be all 12 rows, since every user's faculty has been 'CAMT' since 0021 and
-- the app never assigns a non-CAMT house; the guard is defense-in-depth, not
-- expected to ever skip a row.
DELETE FROM houses h
WHERE h.faculty <> 'CAMT'
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.house_id = h.id)
  AND NOT EXISTS (SELECT 1 FROM score_history sh WHERE sh.house_id = h.id);
