import postgres from "postgres";

const url = process.env.DATABASE_URL;
const sql = postgres(url, { max: 1, prepare: !url.includes(":6543") });

try {
  const nullable = await sql`
    SELECT is_nullable FROM information_schema.columns
    WHERE table_name = 'score_history' AND column_name = 'house_id'
  `;
  console.log("house_id is_nullable:", nullable[0]?.is_nullable);

  const total = await sql`SELECT count(*)::int AS n FROM score_history`;
  console.log("total score_history rows:", total[0].n);

  const nulls = await sql`SELECT count(*)::int AS n FROM score_history WHERE house_id IS NULL`;
  console.log("rows with NULL house_id:", nulls[0].n);

  // Rows whose house_id points to a NON-existent house (orphaned FK target).
  const orphan = await sql`
    SELECT count(*)::int AS n FROM score_history sh
    LEFT JOIN houses h ON h.id = sh.house_id
    WHERE sh.house_id IS NOT NULL AND h.id IS NULL
  `;
  console.log("rows with orphaned house_id (no matching house):", orphan[0].n);

  console.log("\ndistinct house_id values in score_history:");
  const distinct = await sql`SELECT house_id, count(*)::int AS n FROM score_history GROUP BY house_id ORDER BY n DESC`;
  for (const r of distinct) console.log("  ", JSON.stringify(r.house_id), "->", r.n);

  console.log("\nhouses table ids:");
  const houses = await sql`SELECT id, name FROM houses ORDER BY id`;
  for (const h of houses) console.log("  ", h.id, h.name);

  console.log("\nlatest 5 rows:");
  const latest = await sql`SELECT id, house_id, delta, left(reason, 60) AS reason FROM score_history ORDER BY timestamp DESC LIMIT 5`;
  for (const r of latest) console.log("  ", r.house_id, r.delta, r.reason);
} catch (e) {
  console.error("DIAG ERROR:", e.message);
} finally {
  await sql.end();
}
