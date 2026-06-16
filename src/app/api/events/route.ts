import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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

    const eligibleEvents = allEvents.filter((event) => {
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

    // For each event, check if the current user is registered
    const userId = session.user.id!;
    const userAttendances = await db.query.attendance.findMany({
      where: eq(attendance.studentId, userId),
      columns: { eventId: true, checkInTime: true, status: true },
    });

    const attendanceMap = new Map(userAttendances.map((a) => [a.eventId, a.status]));

    const enrichedEvents = eligibleEvents.map((event) => ({
      ...event,
      isRegistered: attendanceMap.has(event.id),
      attendanceStatus: attendanceMap.get(event.id) || null,
    }));

    return NextResponse.json(enrichedEvents);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
