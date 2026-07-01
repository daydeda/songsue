import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";

// Columns read for a normal/staff roster. Medical free-text + emergency contacts
// are fetched so super_admin/admin get full detail and registration/organizer can
// have the medical-CATEGORY signal derived below; they are stripped per-role in
// the sanitize step.
const FULL_USER_COLUMNS = {
  id: true,
  name: true,
  nickname: true,
  studentId: true,
  major: true,
  phone: true,
  role: true,
  roles: true,
  chronicDiseases: true,
  medicalHistory: true,
  drugAllergies: true,
  foodAllergies: true,
  dietaryRestrictions: true,
  faintingHistory: true,
  emergencyMedication: true,
  emergencyContacts: true,
} as const;

// Thin-roster roles (smo / club_president / major_president) only ever receive
// identity + check-in (see sanitize step), so don't even fetch phone, emergency
// contacts, or medical detail. A strict subset of FULL_USER_COLUMNS.
const THIN_USER_COLUMNS = {
  id: true,
  name: true,
  nickname: true,
  studentId: true,
  major: true,
  role: true,
  roles: true,
} as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const myRoles = session?.user?.roles ?? (session?.user?.role ? [session.user.role] : []);
    // Staff roles get the full/standard roster. Scanner-only student-leader roles
    // (smo, club_president, major_president) may also view attendance, but get a
    // THIN roster only (see isThinRoster below).
    const isStaffRole = myRoles.some((r) => ["super_admin", "admin", "registration", "organizer"].includes(r));
    const isThinRosterRole = myRoles.some((r) => ["smo", "club_president", "major_president"].includes(r));
    if (!session?.user || (!isStaffRole && !isThinRosterRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // PDPA-sensitive medical & emergency-contact data is restricted to
    // super_admin/admin (mirrors canExportAttendance on the admin events page).
    // registration/organizer get the roster without health info.
    const canViewMedical = myRoles.includes("super_admin") || myRoles.includes("admin");
    // Thin roster: scanner-only student-leader roles see basic identity + check-in
    // only — NO phone, emergency contacts, or medical signal. Any staff role
    // overrides this (a user holding both staff + a leader role gets the full view).
    const isThinRoster = !isStaffRole;

    const { id: eventId } = await params;

    // Event scoping for president roles (mirrors the /api/admin/events list filter):
    // club_president / major_president may only read attendance for events they
    // manage (managedByRoles), independent of allowedRoles. Staff and smo unscoped.
    const presidentTags = myRoles.filter((r) => ["club_president", "major_president"].includes(r));
    if (!isStaffRole && presidentTags.length > 0) {
      const ev = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { managedByRoles: true },
      });
      const managed = (ev?.managedByRoles ?? []).some((r) => presidentTags.includes(r));
      if (!managed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // Optional ?sessionId= filter narrows the roster to one day of a multi-day event.
    const sessionIdFilter = new URL(req.url).searchParams.get("sessionId");

    const list = await db.query.attendance.findMany({
      where: sessionIdFilter
        ? and(eq(attendance.eventId, eventId), eq(attendance.sessionId, sessionIdFilter))
        : eq(attendance.eventId, eventId),
      with: {
        // Which session (day) this check-in belongs to, for per-day reporting.
        session: {
          columns: { id: true, title: true, sortOrder: true, startTime: true, endTime: true },
        },
        user: {
          // Staff get the full SELECT (medical detail is read here so the
          // "has a condition" signal can be derived, then forwarded only to
          // super_admin/admin). Thin-roster roles get a reduced SELECT — phone /
          // emergency contacts / medical are stripped from their response anyway,
          // so they aren't fetched. The cast keeps the inferred row type stable;
          // the omitted columns are simply absent at runtime and never read on the
          // thin-roster path.
          columns: (isThinRoster
            ? THIN_USER_COLUMNS
            : FULL_USER_COLUMNS) as typeof FULL_USER_COLUMNS,
          with: {
            house: {
              columns: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
    });

    // Which medical CATEGORIES a user filled in (mirrors hasActualMedicalInfo
    // on the client). "-" and blanks are treated as empty. The identifiers match
    // i18n keys so the client can translate them directly — values are never
    // included, so non-admins learn the category but not the detail.
    const isMeaningful = (v: unknown) =>
      typeof v === "string" ? v.trim() !== "" && v.trim() !== "-" : !!v;
    const medicalCategoriesOf = (u: (typeof list)[number]["user"]): string[] => {
      if (!u) return [];
      const cats: string[] = [];
      if (isMeaningful(u.chronicDiseases)) cats.push("chronicDiseases");
      if (isMeaningful(u.medicalHistory)) cats.push("medicalHistory");
      if (isMeaningful(u.drugAllergies)) cats.push("drugAllergies");
      if (isMeaningful(u.foodAllergies)) cats.push("foodAllergies");
      if (isMeaningful(u.dietaryRestrictions)) cats.push("dietaryRestrictions");
      if (isMeaningful(u.emergencyMedication)) cats.push("emergencyMed");
      if (u.faintingHistory === true) cats.push("faintingHistory");
      return cats;
    };

    // super_admin/admin receive the full record (plus the hasMedicalInfo flag).
    // registration/organizer get only the list of categories present — never the
    // detail the student filled in — and no meds-check status (which would
    // itself reveal a condition).
    const sanitized = list.map((row) => {
      const u = row.user;
      const medicalCategories = medicalCategoriesOf(u);
      const hasMedicalInfo = medicalCategories.length > 0;
      if (canViewMedical) {
        return { ...row, user: u ? { ...u, hasMedicalInfo } : u };
      }
      // Scanner-only student-leader roles: identity + check-in only. Strip phone,
      // emergency contacts, and the medical signal (no hasMedicalInfo/categories).
      if (isThinRoster) {
        const thinUser = u && {
          id: u.id,
          name: u.name,
          nickname: u.nickname,
          studentId: u.studentId,
          major: u.major,
          role: u.role,
          roles: u.roles,
          house: u.house,
        };
        return { ...row, medsCheckOption: null, user: thinUser };
      }
      const safeUser = u && {
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        studentId: u.studentId,
        major: u.major,
        phone: u.phone,
        role: u.role,
        roles: u.roles,
        emergencyContacts: u.emergencyContacts,
        house: u.house,
        hasMedicalInfo,
        medicalCategories,
      };
      return { ...row, medsCheckOption: null, user: safeUser };
    });

    // FE-12 / PDPA: log every access that returns sensitive data. Admins receive
    // full medical detail; registration/organizer receive emergency contacts + the
    // medical-category signal — BOTH are auditable PDPA reads, so log them too. This
    // used to fire ONLY for canViewMedical, leaving registration/organizer reads of
    // emergency-contact PII untracked. Thin-roster scanner roles get no sensitive
    // data (identity + check-in only), so they are not logged.
    if (canViewMedical) {
      await AuditService.logAction({
        actorId: session.user.id!,
        action: `Viewed Attendance List for Event ${eventId} (included health detail + emergency contacts)`,
        ipAddress: getClientIp(req),
      });
    } else if (!isThinRoster) {
      await AuditService.logAction({
        actorId: session.user.id!,
        action: `Viewed Attendance List for Event ${eventId} (emergency contacts + medical-category signal)`,
        ipAddress: getClientIp(req),
      });
    }

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("Failed to fetch attendance:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
