import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { checkAndAwardPastEventPoints } from "@/lib/award-points";

// GET /api/events — List all upcoming & past events (student-facing, FE-04)
export async function GET() {
  try {
    const session = await auth();

    // Automatically check and award past event points
    await checkAndAwardPastEventPoints();

    const allEvents = await db.query.events.findMany({
      orderBy: (events, { asc }) => [asc(events.startTime)],
    });

    if (!session?.user) {
      // For guest, filter events by allowedRoles: only show if no role limits, or if "student" is allowed
      const eligibleEvents = allEvents.filter((event) => {
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
    // Admin roles bypass all role restrictions
    const isAdminRole = userRoles.some(r => ["super_admin", "admin", "registration", "organizer"].includes(r));

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
