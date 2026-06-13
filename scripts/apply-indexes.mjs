import postgres from "postgres";
import { readFileSync } from "node:fs";

// Read DATABASE_URL from .env.local (production Supabase pooler).
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error("DATABASE_URL not found in .env.local");
const url = match[1].trim().replace(/^["']|["']$/g, "");

const usingPooler = url.includes(":6543");
const sql = postgres(url, { max: 1, prepare: !usingPooler, idle_timeout: 5, connect_timeout: 15 });

const indexes = [
  ["idx_attendance_event_student", `CREATE INDEX IF NOT EXISTS idx_attendance_event_student ON attendance(event_id, student_id)`],
  ["idx_attendance_student",       `CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)`],
  ["idx_attendance_checkin_time",  `CREATE INDEX IF NOT EXISTS idx_attendance_checkin_time ON attendance(check_in_time)`],
  ["idx_score_history_event",      `CREATE INDEX IF NOT EXISTS idx_score_history_event ON score_history(event_id)`],
  ["idx_score_history_timestamp",  `CREATE INDEX IF NOT EXISTS idx_score_history_timestamp ON score_history(timestamp)`],
  ["idx_users_profile_completed",  `CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed)`],
  ["idx_users_house_id",           `CREATE INDEX IF NOT EXISTS idx_users_house_id ON users(house_id)`],
  ["idx_session_userid",           `CREATE INDEX IF NOT EXISTS idx_session_userid ON session("userId")`],
  ["idx_account_userid",           `CREATE INDEX IF NOT EXISTS idx_account_userid ON account("userId")`],
];

try {
  // Show table sizes so we know an index build won't lock writes for long.
  const sizes = await sql`
    SELECT relname AS table, n_live_tup AS approx_rows
    FROM pg_stat_user_tables
    WHERE relname IN ('attendance','users','score_history','session','account','events','houses')
    ORDER BY n_live_tup DESC`;
  console.log("Table sizes (approx live rows):");
  for (const r of sizes) console.log(`  ${r.table.padEnd(16)} ${r.approx_rows}`);
  console.log("");

  for (const [name, ddl] of indexes) {
    const t0 = process.hrtime.bigint();
    await sql.unsafe(ddl);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`  ✓ ${name.padEnd(30)} ${ms.toFixed(0)}ms`);
  }
  console.log("\nAll indexes applied.");
} finally {
  await sql.end({ timeout: 5 });
}
