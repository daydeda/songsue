// One-off, idempotent recolor of the 4 houses.
//
// The houses.color column is the runtime source of truth for most house UI, so
// editing seed.ts / CSS vars alone does NOT change an already-seeded database.
// This script UPDATEs the colors in place — non-destructive, safe to re-run.
//
//   New palette (DB id is a legacy colour name; the *value* is what renders):
//     red    (Mom)   -> #ef4444  Red    (unchanged)
//     green  (To)    -> #94a3b8  White → silver/pewter (visible on the light theme)
//     yellow (Luang) -> #3b82f6  Blue
//     blue   (Makon) -> #22c55e  Green
//
// Run against LOCAL first, then prod:
//   node --env-file=.env.local scripts/recolor-houses.mjs
//   node --env-file=.env       scripts/recolor-houses.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set — run with --env-file=.env.local (local) or --env-file=.env (prod)");

const COLORS = [
  ["red", "#ef4444"],
  ["green", "#94a3b8"],
  ["yellow", "#3b82f6"],
  ["blue", "#22c55e"],
];

const sql = postgres(url, { max: 1, prepare: !url.includes(":6543"), idle_timeout: 5, connect_timeout: 15 });

try {
  const before = await sql`SELECT id, name, color FROM houses ORDER BY id`;
  console.log("Before:", before.map((h) => `${h.id}/${h.name}=${h.color}`).join("  "));

  for (const [id, color] of COLORS) {
    await sql`UPDATE houses SET color = ${color} WHERE id = ${id}`;
  }

  const after = await sql`SELECT id, name, color FROM houses ORDER BY id`;
  console.log("After: ", after.map((h) => `${h.id}/${h.name}=${h.color}`).join("  "));
  console.log("Done.");
} finally {
  await sql.end();
}
