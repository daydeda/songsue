/**
 * Rebuild the house-less "no points awarded" activity rows that an earlier
 * DELETE-based migration removed from score_history.
 *
 * Re-derives, from events/forms, the SAME delta=0 / house_id=NULL rows that
 * award-points.ts writes today, and re-inserts any that are missing. Mirrors the
 * award logic exactly:
 *   - event, 0 attendees                -> "Event "X" ended with no attendees. No points awarded."
 *   - event, attendees but none housed  -> "Event "X" ended but all checked-in students were unassigned. No points awarded."
 *   - event, housed attendees, 0 points -> "Event "X" ended. No points awarded."
 *   - form, housed submissions, 0 points -> "Evaluation form "X" closed. No points awarded."
 *
 * NEVER touches points and only ever inserts delta=0 / house_id=NULL rows.
 * Idempotent: skips a row if one with the same (event_id, reason) already exists.
 *
 * Dry-run by default (read-only). Set APPLY=yes to actually insert.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const APPLY = process.env.APPLY === "yes";
const sql = postgres(url, { max: 1, prepare: !url.includes(":6543") });

// Build the list of rows that SHOULD exist, then insert the missing ones.
const planned = []; // { eventId, reason, ts }

try {
  // ── Events ────────────────────────────────────────────────────────────────
  const events = await sql`
    SELECT e.id, e.title, e.end_time, COALESCE(e.points_awarded, 0) AS points_awarded,
      (SELECT count(*) FROM attendance a
        WHERE a.event_id = e.id AND a.status = 'attended')::int AS attended,
      (SELECT count(*) FROM attendance a
        JOIN users u ON u.id = a.student_id
        JOIN houses h ON h.id = u.house_id
        WHERE a.event_id = e.id AND a.status = 'attended')::int AS housed_attended
    FROM events e
    WHERE e.end_time <= now() AND e.winner_awarded_at IS NOT NULL
  `;

  for (const e of events) {
    let reason = null;
    if (e.attended === 0) {
      reason = `Event "${e.title}" ended with no attendees. No points awarded.`;
    } else if (e.housed_attended === 0) {
      reason = `Event "${e.title}" ended but all checked-in students were unassigned. No points awarded.`;
    } else if (e.points_awarded <= 0) {
      reason = `Event "${e.title}" ended. No points awarded.`;
    } else {
      // Housed attendees + points > 0 = a real point winner (delta>0). That row was
      // never deleted and re-creating it would mean re-awarding points — skip.
      continue;
    }
    planned.push({ eventId: e.id, reason, ts: e.end_time });
  }

  // ── Forms (0-point surveys with housed submissions) ─────────────────────────
  const forms = await sql`
    SELECT f.id, f.title, f.event_id, f.closes_at, COALESCE(f.points_awarded, 0) AS points_awarded,
      (SELECT count(*) FROM form_submissions s
        JOIN users u ON u.id = s.student_id
        JOIN houses h ON h.id = u.house_id
        WHERE s.form_id = f.id)::int AS housed_subs
    FROM forms f
    WHERE f.closes_at IS NOT NULL AND f.closes_at <= now() AND f.is_awarded = true
  `;

  for (const f of forms) {
    // Mirror the award path: a row is written only when there were housed
    // submissions (houseList non-empty) AND no points were configured.
    if (f.housed_subs > 0 && f.points_awarded <= 0) {
      planned.push({
        eventId: f.event_id,
        reason: `Evaluation form "${f.title}" closed. No points awarded.`,
        ts: f.closes_at,
      });
    }
  }

  console.log(`Planned house-less rows: ${planned.length}`);
  for (const p of planned) console.log(`  [${p.ts?.toISOString?.() ?? p.ts}] ${p.reason}`);

  if (!APPLY) {
    console.log("\nDRY RUN — no rows inserted. Re-run with APPLY=yes to write.");
  } else {
    let inserted = 0;
    for (const p of planned) {
      const res = await sql`
        INSERT INTO score_history (house_id, event_id, delta, reason, timestamp)
        SELECT NULL, ${p.eventId}, 0, ${p.reason}, ${p.ts}
        WHERE NOT EXISTS (
          SELECT 1 FROM score_history
          WHERE reason = ${p.reason}
            AND (event_id = ${p.eventId} OR (${p.eventId}::uuid IS NULL AND event_id IS NULL))
        )
        RETURNING id
      `;
      if (res.length > 0) inserted++;
    }
    console.log(`\nInserted ${inserted} new row(s) (${planned.length - inserted} already existed).`);
  }
} catch (e) {
  console.error("REBUILD ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
