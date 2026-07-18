// One-off, idempotent repair for attendance.is_staff rows left stuck at
// TRUE by staff UNASSIGNMENTS made before today's fix (src/app/api/admin/
// events/[id]/route.ts): previously, is_staff only ever flipped
// false -> true and was never reverted when someone was removed from an
// event's staffUserIds. That left them permanently misclassified as staff
// in the Attendance roster (stuck in the "Staff" section, dropped out of
// the Students section and all student-facing tallies — quota, no-show,
// pre-registered counts) even after being unassigned.
//
// Today's fix makes assign/unassign symmetric going forward (new PUT calls
// now also flip true -> false on removal). This script closes the gap for
// removals that already happened before the fix shipped, so those rows
// aren't stuck until the next time that event happens to be re-saved.
//
// For every event, flip is_staff = false on any attendance row whose
// student_id is CURRENTLY NOT in that event's staffUserIds but whose row
// is still is_staff = true. Only ever true -> false for ids absent from the
// live staffUserIds list — never touches rows for students who are still
// currently staff. Safe to re-run; a second run is a no-op.
//
// Run against LOCAL first, then prod:
//   node --env-file=.env.local scripts/repair-stale-attendance-isstaff.mjs
//   node --env-file=.env       scripts/repair-stale-attendance-isstaff.mjs
// On the self-hosted deploy, run from the Portainer console inside activecamt-app
// (DATABASE_URL is already in the container env, no --env-file needed):
//   node scripts/repair-stale-attendance-isstaff.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set — run with --env-file=.env.local (local) or --env-file=.env (prod), or from the Portainer console where it's already in the container env");

const sql = postgres(url, { max: 1, prepare: !url.includes(":6543"), idle_timeout: 5, connect_timeout: 15 });

try {
  const events = await sql`SELECT id, title, staff_user_ids FROM events`;
  console.log(`Found ${events.length} event(s) to check.`);

  let eventsTouched = 0;
  let rowsFlipped = 0;

  for (const e of events) {
    const staffIds = Array.isArray(e.staff_user_ids) ? e.staff_user_ids : [];

    const flipped = staffIds.length > 0
      ? await sql`
          UPDATE attendance
          SET is_staff = false
          WHERE event_id = ${e.id}
            AND is_staff = true
            AND student_id NOT IN ${sql(staffIds)}
          RETURNING id
        `
      : await sql`
          UPDATE attendance
          SET is_staff = false
          WHERE event_id = ${e.id}
            AND is_staff = true
          RETURNING id
        `;

    if (flipped.length > 0) {
      eventsTouched++;
      rowsFlipped += flipped.length;
      console.log(`  ${e.title} (${e.id}): flipped ${flipped.length} row(s) back to is_staff = false`);
    }
  }

  console.log(`Done. ${eventsTouched} event(s) touched, ${rowsFlipped} attendance row(s) flipped.`);
} finally {
  await sql.end({ timeout: 5 });
}
