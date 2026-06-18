import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users, forms, formSubmissions } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getFormAvailability } from "@/lib/form-access";

// Fail fast instead of hanging to the 300s platform default if the DB pooler stalls.
export const maxDuration = 20;


// GET /api/events — List all upcoming & past events (student-facing, FE-04)
export async function GET() {
  try {
    const session = await auth();


    const allEvents = await db.query.events.findMany({
      orderBy: (events, { asc }) => [asc(events.startTime)],
    });

    if (!session?.user) {
      // For guest, filter events by allowedRoles: only show if no role limits, or if "student" is allowed
      const eligibleEvents = allEvents.filter((event) => {
        // A guest has no major, so a major-restricted event can never match.
        if (event.allowedMajors && (event.allowedMajors as string[]).length > 0) {
          return false;
        }
        if (event.allowedRoles && (event.allowedRoles as string[]).length > 0) {
          return (event.allowedRoles as string[]).includes("student");
        }
        return true;
      });

      const enrichedEvents = eligibleEvents.map((event) => ({
        ...event,
        isRegistered: false,
        attendanceStatus: null,
      }));
      return NextResponse.json(enrichedEvents);
    }

    const studentId = session.user.studentId || "";
    const cleanId = studentId.trim();
    let isThai = true;
    let isIntl = false;
    
    if (cleanId.length >= 3) {
      const lastThreeDigitFirst = cleanId.slice(-3)[0];
      if (lastThreeDigitFirst === "5") {
        isThai = false;
        isIntl = true;
      }
    }

    const userRoles = session.user.roles || [session.user.role || "student"];
    // Admin roles bypass all role/major restrictions
    const isAdminRole = userRoles.some(r => ["super_admin", "admin", "registration", "organizer"].includes(r));

    // Major used for major-based access control (not on the session token).
    const me = await db.query.users.findFirst({
      where: eq(users.id, session.user.id!),
      columns: { major: true },
    });
    const userMajor = me?.major ?? null;

    // Fetch the user's attendance up front: a student who has an attendance row
    // for an event must always see it on their dashboard, even if the event's
    // audience/role/major restrictions would otherwise exclude them. Admins can
    // manually check in (or walk in) a student to a restricted event via the
    // scanner — which bypasses every eligibility rule below — so the dashboard
    // has to honour that same bypass or the check-in silently vanishes here.
    const userId = session.user.id!;
    const userAttendances = await db.query.attendance.findMany({
      where: eq(attendance.studentId, userId),
      columns: { eventId: true, checkInTime: true, status: true },
    });

    const attendanceMap = new Map(userAttendances.map((a) => [a.eventId, a.status]));

    const eligibleEvents = allEvents.filter((event) => {
      // Always surface an event the student is registered for / checked into,
      // regardless of the eligibility rules below.
      if (attendanceMap.has(event.id)) return true;

      const targetThai = event.targetThai ?? true;
      const targetInternational = event.targetInternational ?? true;

      // If both targets are unchecked, it means anyone can join (default to both true)
      const effectiveThai = (!targetThai && !targetInternational) ? true : targetThai;
      const effectiveIntl = (!targetThai && !targetInternational) ? true : targetInternational;

      if (isThai && !effectiveThai) return false;
      if (isIntl && !effectiveIntl) return false;

      // Role-based access control: skip if event has allowedRoles and user's role is not in it
      // Admin roles always bypass this check
      if (!isAdminRole && event.allowedRoles && (event.allowedRoles as string[]).length > 0) {
        // Normalize staff aliases (professor, officer → staff)
        const effectiveUserRoles = userRoles.map(r => ["professor", "officer"].includes(r) ? "staff" : r);
        const hasMatchingRole = effectiveUserRoles.some(r => (event.allowedRoles as string[]).includes(r));
        if (!hasMatchingRole) return false;
      }

      // Major-based access control: skip if event restricts majors and the user's
      // major is not in the list. Admin roles always bypass.
      if (!isAdminRole && event.allowedMajors && (event.allowedMajors as string[]).length > 0) {
        if (!userMajor || !(event.allowedMajors as string[]).includes(userMajor)) return false;
      }

      return true;
    });

    // Pre-test (K_pre) status per event, so the dashboard can force a student to
    // complete a required pre-test right after registering. We surface the form id
    // plus a status: "open" (must complete), "submitted" (done), or
    // "upcoming"/"closed" (can't submit yet/anymore, so not forced).
    const eligibleIds = eligibleEvents.map((e) => e.id);
    const preForms = eligibleIds.length
      ? await db.query.forms.findMany({
          where: and(eq(forms.formType, "K_pre"), inArray(forms.eventId, eligibleIds)),
          orderBy: (f, { asc }) => [asc(f.sortOrder), asc(f.createdAt)],
        })
      : [];

    // First K_pre form per event (an event normally has at most one).
    const preByEvent = new Map<string, (typeof preForms)[number]>();
    for (const f of preForms) {
      if (!preByEvent.has(f.eventId)) preByEvent.set(f.eventId, f);
    }

    const preFormIds = preForms.map((f) => f.id);
    const preSubs = preFormIds.length
      ? await db.query.formSubmissions.findMany({
          where: and(
            eq(formSubmissions.studentId, userId),
            inArray(formSubmissions.formId, preFormIds)
          ),
          columns: { formId: true },
        })
      : [];
    const submittedFormIds = new Set(preSubs.map((s) => s.formId));

    const enrichedEvents = eligibleEvents.map((event) => {
      const pf = preByEvent.get(event.id);
      const preTest = pf
        ? {
            formId: pf.id,
            title: pf.title,
            status: submittedFormIds.has(pf.id) ? "submitted" : getFormAvailability(pf),
          }
        : null;
      return {
        ...event,
        isRegistered: attendanceMap.has(event.id),
        attendanceStatus: attendanceMap.get(event.id) || null,
        preTest,
      };
    });

    return NextResponse.json(enrichedEvents);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
