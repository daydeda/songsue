// Per-faculty admin data scoping — an orthogonal axis to EventScopeService's
// club/major ownership scoping. This restricts WHICH STUDENTS' data a staff
// view returns (students list, dashboard stats, event rosters, scanner),
// not which events a president manages. Every non-super_admin role is
// scoped to exactly one faculty (their own users.faculty); only super_admin
// sees across all 4. See src/lib/faculties.ts for the FacultyId set.

import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { type FacultyId, isFacultyId, normalizeFaculty } from "@/lib/faculties";

// True iff a row's role(s) are nothing but "student" (or absent) — i.e. the
// null->CAMT default below is safe to apply. A brand-new staff/leadership
// account (admin, registration, smo, club_president, ...) has faculty=null
// until a super_admin assigns one; defaulting THAT to CAMT would let a
// CAMT-scoped admin see/edit/delete every other faculty's still-unassigned
// staff during rollout. Only ever skip the default for a row that actually
// holds an elevated role — a plain student keeps the historical behavior.
function isStudentOnlyRow(role: unknown, roles: unknown): boolean {
  const roleList = Array.isArray(roles) && roles.length > 0
    ? roles
    : (typeof role === "string" && role ? [role] : []);
  return roleList.length === 0 || roleList.every((r) => r === "student");
}

export type FacultyViewScope =
  | { global: true }
  | { global: false; faculty: FacultyId }
  // A non-super_admin account with no faculty assigned yet. Every helper
  // below treats this as "sees nothing" — deny-safe, since defaulting an
  // unassigned staff account to CAMT would either leak CAMT data to them or
  // misroute a real non-CAMT admin before someone remembers to assign them
  // (same rationale as facultyFromStudentId's null-must-not-default-to-CAMT
  // comment).
  | { global: false; faculty: null };

/**
 * Resolves a viewer's faculty scope from their role set (pass
 * effectiveRoles(session.user.role, session.user.roles)) and their raw
 * session.user.faculty. super_admin is always global; every other role is
 * scoped to their own faculty, or to nothing if unassigned.
 */
export function resolveFacultyViewScope(roles: string[], rawFaculty: unknown): FacultyViewScope {
  if (roles.includes("super_admin")) return { global: true };
  return isFacultyId(rawFaculty) ? { global: false, faculty: rawFaculty } : { global: false, faculty: null };
}

/**
 * Drizzle WHERE fragment restricting a query to rows in the given faculty.
 * Mirrors normalizeFaculty's null->CAMT convention for the ROW being
 * filtered (a legacy student with faculty=null already displays/behaves as
 * CAMT everywhere else), so a CAMT-scoped viewer still sees those rows —
 * but ONLY when the row is a plain student. Pass `roleColumn` (users.role)
 * whenever the query can touch non-student rows (e.g. the students/users
 * directory, which lists every account) so a null-faculty STAFF row is
 * excluded from the CAMT default instead of leaking into it (see
 * isStudentOnlyRow above). Omit `roleColumn` only when the table being
 * filtered can never contain a non-student row.
 * Only call with a concrete (non-null) faculty — a `{ faculty: null }` scope
 * must short-circuit to "no rows" at the call site instead.
 */
export function facultyRowCondition(column: AnyPgColumn, faculty: FacultyId, roleColumn?: AnyPgColumn): SQL {
  if (faculty !== "CAMT") return eq(column, faculty);
  const nullFacultyMatch = roleColumn
    ? and(isNull(column), or(isNull(roleColumn), eq(roleColumn, "student")))!
    : isNull(column);
  return or(eq(column, faculty), nullFacultyMatch)!;
}

/**
 * In-memory check for a single already-fetched row's faculty against a
 * viewer's scope. For routes that fetch via a relational `with: { user }`
 * and can't push a related-table WHERE into the query builder (attendance/
 * export/report rosters). Pass the row's role/roles whenever it might be a
 * staff account (not just a participant/student) — see isStudentOnlyRow.
 */
export function matchesFacultyScope(
  rowFaculty: unknown,
  scope: FacultyViewScope,
  rowRole?: unknown,
  rowRoles?: unknown,
): boolean {
  if (scope.global) return true;
  if (scope.faculty === null) return false;
  if (rowFaculty == null && !isStudentOnlyRow(rowRole, rowRoles)) return false;
  return normalizeFaculty(rowFaculty) === scope.faculty;
}
