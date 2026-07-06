// One-off recovery script. The four-faculty-houses migration (drizzle/0021,
// src/db/migrate.ts step 65) reset EVERY user's house_id to NULL, and the
// balance-only re-derivation logic that ran afterwards (QR check-in +
// scripts/backfill-user-houses.mjs) has no memory of anyone's PREVIOUS house —
// that fact was only ever stored in the single house_id column that just got
// wiped, so most users ended up reshuffled into an essentially arbitrary house.
//
// Recovery source: the legacy Supabase Postgres (production before the
// 2026-06-24 self-hosted cutover) is frozen from before this migration ever
// ran there — its `houses` table still has no faculty/color_group columns at
// all, and 438/463 of its users still carry their correct pre-reset house_id.
// Since users.id is the stable Auth.js/OAuth id (not a fresh per-DB uuid) and
// every other piece of user data clearly carried over through the cutover
// intact, this snapshot is the real pre-shuffle house assignment for anyone
// who signed up before 2026-06-24.
//
// This does NOT cover anyone who signed up between the cutover (2026-06-24)
// and the migration that broke this (2026-07-05) — they have no Supabase
// record and aren't touched by this script (counted as "not found in source").
//
// Run ONCE from the Portainer console inside activecamt-app (DATABASE_URL
// there is already the self-hosted prod DB — the RESTORE TARGET). Pass the
// Supabase connection string as SOURCE_DATABASE_URL inline (not in the stack
// env), same pattern as scripts/migrate-supabase-files.mjs:
//   SOURCE_DATABASE_URL="postgresql://...supabase..." node scripts/restore-houses-from-supabase.mjs
//
// SAFE TO RE-RUN: only overwrites users.house_id for ids that exist in both
// databases; never deletes, never touches score_history/points.
import postgres from "postgres";

const targetUrl = process.env.DATABASE_URL;
if (!targetUrl) throw new Error("DATABASE_URL not set — run from the Portainer console where it's already in the container env");

const sourceUrl = process.env.SOURCE_DATABASE_URL;
if (!sourceUrl) throw new Error("SOURCE_DATABASE_URL not set — pass the legacy Supabase connection string inline, e.g. SOURCE_DATABASE_URL=\"...\" node scripts/restore-houses-from-supabase.mjs");

const target = postgres(targetUrl, { max: 1, prepare: !targetUrl.includes(":6543"), idle_timeout: 5, connect_timeout: 15 });
const source = postgres(sourceUrl, { max: 1, prepare: !sourceUrl.includes(":6543"), idle_timeout: 5, connect_timeout: 15 });

const VALID_HOUSE_IDS = new Set(["red", "green", "yellow", "blue"]);

try {
  const rows = await source`SELECT id, house_id FROM users WHERE house_id IS NOT NULL`;
  console.log(`Found ${rows.length} user(s) with a house in the Supabase snapshot.`);

  let restored = 0;
  let notFound = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    if (!VALID_HOUSE_IDS.has(row.house_id)) {
      console.warn(`  ⚠️ unexpected house_id "${row.house_id}" for user ${row.id} — skipping`);
      skippedInvalid++;
      continue;
    }

    const result = await target`
      UPDATE users SET house_id = ${row.house_id}, updated_at = now()
      WHERE id = ${row.id}
    `;
    if (result.count > 0) {
      restored++;
    } else {
      notFound++;
    }
  }

  console.log(`Done. Restored ${restored} user(s), ${notFound} not found in target (joined after the Supabase cutover), ${skippedInvalid} skipped (invalid house_id).`);

  const byHouse = await target`
    SELECT color_group, COUNT(*)::int AS members
    FROM houses h
    LEFT JOIN users us ON us.house_id = h.id
    GROUP BY color_group
    ORDER BY color_group
  `;
  console.log("Post-restore distribution:");
  for (const r of byHouse) console.log(`  ${r.color_group.padEnd(8)} ${r.members}`);

  const stillNull = await target`SELECT count(*)::int AS c FROM users WHERE house_id IS NULL`;
  console.log(`Users still with no house: ${stillNull[0].c}`);
} finally {
  await target.end({ timeout: 5 });
  await source.end({ timeout: 5 });
}
