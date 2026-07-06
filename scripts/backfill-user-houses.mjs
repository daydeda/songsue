// One-off, idempotent backfill for users left house-less after the four-faculty-
// houses migration (drizzle/0021, src/db/migrate.ts step 65) intentionally reset
// EVERY user's house_id to NULL so it would re-derive per-faculty at next check-in
// (ScannerService.ensureHouseAssigned). That only fires during a QR scan, so until
// each student's next event check-in their house/color shows blank everywhere
// (dashboard, profile, leaderboard membership) — this script assigns it right now
// instead of waiting.
//
// Mirrors the app's own balancing logic (HousesService.pickBalancedHouseIdForFaculty
// / pickBalancedHouseIdForStaff): least-populated colour house within the user's
// faculty, staff balanced by staff-count only. Only touches house_id IS NULL rows,
// so it's safe to re-run (a second run is a no-op).
//
// Run against LOCAL first, then prod:
//   node --env-file=.env.local scripts/backfill-user-houses.mjs
//   node --env-file=.env       scripts/backfill-user-houses.mjs
// On the self-hosted deploy, run from the Portainer console inside activecamt-app
// (DATABASE_URL is already in the container env, no --env-file needed):
//   node scripts/backfill-user-houses.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set — run with --env-file=.env.local (local) or --env-file=.env (prod), or from the Portainer console where it's already in the container env");

const sql = postgres(url, { max: 1, prepare: !url.includes(":6543"), idle_timeout: 5, connect_timeout: 15 });

try {
  const pending = await sql`
    SELECT id, faculty, role, roles FROM users WHERE house_id IS NULL
  `;
  console.log(`Found ${pending.length} user(s) with no house assigned.`);

  let assigned = 0;
  let skipped = 0;

  for (const u of pending) {
    const faculty = u.faculty || "CAMT";
    const isStaff = u.role === "staff" || (Array.isArray(u.roles) && u.roles.includes("staff"));

    // Same shape as HousesService.pickBalancedHouseIdForFaculty /
    // pickBalancedHouseIdForStaff: least-populated house in this faculty, counting
    // either everyone or staff-only. Re-queried per user so counts stay balanced
    // across the whole run, not just against the pre-run snapshot.
    const rows = isStaff
      ? await sql`
          SELECT h.id
          FROM houses h
          LEFT JOIN users us ON us.house_id = h.id AND us.role = 'staff'
          WHERE h.faculty = ${faculty}
          GROUP BY h.id
          ORDER BY COUNT(us.id) ASC, h.id ASC
          LIMIT 1
        `
      : await sql`
          SELECT h.id
          FROM houses h
          LEFT JOIN users us ON us.house_id = h.id
          WHERE h.faculty = ${faculty}
          GROUP BY h.id
          ORDER BY COUNT(us.id) ASC, h.id ASC
          LIMIT 1
        `;

    const houseId = rows[0]?.id;
    if (!houseId) {
      console.warn(`  ⚠️ no house seeded for faculty=${faculty} — skipping user ${u.id}`);
      skipped++;
      continue;
    }

    await sql`
      UPDATE users SET house_id = ${houseId}, updated_at = now()
      WHERE id = ${u.id} AND house_id IS NULL
    `;
    assigned++;
  }

  console.log(`Done. Assigned ${assigned} user(s), skipped ${skipped}.`);

  const byHouse = await sql`
    SELECT h.faculty, h.color_group, COUNT(us.id)::int AS members
    FROM houses h
    LEFT JOIN users us ON us.house_id = h.id
    GROUP BY h.faculty, h.color_group
    ORDER BY h.faculty, h.color_group
  `;
  console.log("Post-backfill distribution:");
  for (const r of byHouse) console.log(`  ${r.faculty.padEnd(8)} ${r.color_group.padEnd(8)} ${r.members}`);
} finally {
  await sql.end({ timeout: 5 });
}
