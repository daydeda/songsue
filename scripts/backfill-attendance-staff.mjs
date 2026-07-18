// One-off, idempotent backfill for attendance.is_staff rows left stale by
// staff assignments made BEFORE PR #177 (fix/staff-attendance-stale-isstaff,
// merged 2026-07-13, tag v1.4.1).
//
// attendance.is_staff is a snapshot taken once at register/check-in time
// (src/app/api/events/[id]/register/route.ts) and deliberately never
// re-derived later — except that PR #177 added a diff-on-save backfill to
// PUT /api/admin/events/[id] (src/app/api/admin/events/[id]/route.ts): when
// an admin saves a NEW change to staffUserIds, newly-added ids get
// is_staff = true backfilled onto their existing attendance rows.
//
// That only covers assignments made AFTER the fix shipped. Any event whose
// staffUserIds already included someone before the PUT-time backfill existed
// — and whose staffUserIds hasn't been re-saved since — still has is_staff
// stuck at false for those staff. Concretely this let them still show up in
// the no-show strike preview/apply flow (findNoShowStudentIds in
// api/admin/events/[id]/apply-strikes/route.ts filters on the raw is_staff
// column, not the live staffUserIds list), so they could be struck as
// no-shows despite actually being event staff.
//
// This script closes that gap once, repo-wide: for every event, flip
// is_staff = true on any attendance row whose student_id is in that event's
// CURRENT staffUserIds and is currently false. Only ever false -> true,
// never reverts staff -> non-staff (same non-destructive, anti-gaming-safe
// direction as the PUT-time backfill) — safe to re-run, a second run is a
// no-op.
//
// Run against LOCAL first, then prod:
//   node --env-file=.env.local scripts/backfill-attendance-staff.mjs
//   node --env-file=.env       scripts/backfill-attendance-staff.mjs
// On the self-hosted deploy, run from the Portainer console inside activecamt-app
// (DATABASE_URL is already in the container env, no --env-file needed):
//   node scripts/backfill-attendance-staff.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set — run with --env-file=.env.local (local) or --env-file=.env (prod), or from the Portainer console where it's already in the container env");

const sql = postgres(url, { max: 1, prepare: !url.includes(":6543"), idle_timeout: 5, connect_timeout: 15 });

try {
  const events = await sql`
    SELECT id, title, staff_user_ids FROM events
    WHERE staff_user_ids IS NOT NULL AND jsonb_array_length(staff_user_ids) > 0
  `;
  console.log(`Found ${events.length} event(s) with a staff list to check.`);

  let eventsTouched = 0;
  let rowsFlipped = 0;

  for (const e of events) {
    const staffIds = e.staff_user_ids;
    if (!Array.isArray(staffIds) || staffIds.length === 0) continue;

    const flipped = await sql`
      UPDATE attendance
      SET is_staff = true
      WHERE event_id = ${e.id}
        AND is_staff = false
        AND student_id IN ${sql(staffIds)}
      RETURNING id
    `;

    if (flipped.length > 0) {
      eventsTouched++;
      rowsFlipped += flipped.length;
      console.log(`  ${e.title} (${e.id}): flipped ${flipped.length} row(s) to is_staff = true`);
    }
  }

  console.log(`Done. ${eventsTouched} event(s) touched, ${rowsFlipped} attendance row(s) flipped.`);
} finally {
  await sql.end({ timeout: 5 });
}
