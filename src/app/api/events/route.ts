import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/events — List all upcoming & past events (student-facing, FE-04)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allEvents = await db.query.events.findMany({
      orderBy: (events, { asc }) => [asc(events.startTime)],
    });

    // For each event, check if the current user is registered
    const userId = session.user.id!;
    const userAttendances = await db.query.attendance.findMany({
      where: eq(attendance.studentId, userId),
      columns: { eventId: true, checkInTime: true, status: true },
    });

    const attendanceMap = new Map(userAttendances.map((a) => [a.eventId, a.status]));

    const enrichedEvents = allEvents.map((event) => ({
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
