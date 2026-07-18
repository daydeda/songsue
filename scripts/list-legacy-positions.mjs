// Read-only report: every user still carrying a value in the LEGACY
// users.position column (superseded by club_members.position, users.majorPosition,
// users.smoPosition, users.anusmoPosition — see src/db/schema.ts). The scoped-position
// migration deliberately did NOT backfill these new columns automatically, since a
// user active in more than one context (club + major, multiple clubs, smo + anusmo,
// ...) makes the old single value ambiguous — guessing which scope it belonged to
// risks writing a wrong title into a context the user never actually held it in.
//
// Run this after applying the migration to see who needs their title manually
// re-assigned in the new scoped UI (admin/clubs's Members modal, admin/majors's Team
// panel, or the Students page's SMO/ANUSMO Position dropdowns). Anyone here who held
// position === "registration" also lost the matching access grant (event-scoped or
// global — see EventScopeService.getRegistrationPositionScope) until reassigned.
//
// Read-only — makes no writes. Run with: node --env-file=.env scripts/list-legacy-positions.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const sql = postgres(url, { max: 1, prepare: !url.includes(":6543") });

try {
  const rows = await sql`
    SELECT
      u.id,
      u.name,
      u.student_id,
      u.position AS legacy_position,
      u.role,
      u.roles,
      u.major,
      (
        SELECT json_agg(json_build_object('clubId', cm.club_id, 'role', cm.role))
        FROM club_members cm
        WHERE cm.user_id = u.id
      ) AS club_memberships
    FROM users u
    WHERE u.position IS NOT NULL
    ORDER BY u.name
  `;

  if (rows.length === 0) {
    console.log("No users carry a legacy users.position value — nothing to reassign.");
  } else {
    console.log(`${rows.length} user(s) with a legacy position needing manual reassignment:\n`);
    for (const r of rows) {
      const roles = Array.isArray(r.roles) && r.roles.length > 0 ? r.roles.join(", ") : (r.role ?? "student");
      const clubs = r.club_memberships
        ? r.club_memberships.map((m) => `${m.clubId}(${m.role})`).join(", ")
        : "none";
      const flag = r.legacy_position === "registration" ? "  <-- was a registration-position holder, check event-scope access" : "";
      console.log(`- ${r.name} (${r.student_id ?? "no student id"})`);
      console.log(`    legacy position: ${r.legacy_position}${flag}`);
      console.log(`    roles: ${roles}`);
      console.log(`    major: ${r.major ?? "none"}`);
      console.log(`    club memberships: ${clubs}`);
      console.log("");
    }
  }
} catch (e) {
  console.error("REPORT ERROR:", e.message);
} finally {
  await sql.end();
}
