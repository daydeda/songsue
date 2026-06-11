import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, scoreHistory } from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recentCheckins = await db.query.attendance.findMany({
      limit: 100, // Show more for "View All"
      // Only genuine check-ins. Registration rows have checkInTime = null, and
      // `ORDER BY ... DESC` is NULLS FIRST in Postgres, so without this filter
      // those un-checked-in rows sort to the top and fall back to new Date()
      // below — making every entry show the current time.
      where: (attendance, { isNotNull }) => isNotNull(attendance.checkInTime),
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
      with: {
        user: { columns: { name: true, nickname: true, studentId: true } },
        event: { columns: { title: true } },
      },
    });

    const recentScores = await db.query.scoreHistory.findMany({
      limit: 100,
      orderBy: (scoreHistory, { desc }) => [desc(scoreHistory.timestamp)],
      with: {
        house: { columns: { id: true, name: true, color: true } },
      },
    });

    // Merge and sort
    const mergedActivity = [
      ...recentCheckins.map(a => ({
        type: "checkin" as const,
        studentName: a.user?.name ?? "Unknown",
        studentId: a.user?.studentId ?? "",
        eventTitle: a.event?.title ?? "Unknown Event",
        timestamp: a.checkInTime?.toISOString() || new Date().toISOString(),
      })),
      ...recentScores.map(s => ({
        type: "score" as const,
        houseId: s.house?.id,
        houseName: s.house?.name ?? "Unknown",
        houseColor: s.house?.color ?? "var(--accent-primary)",
        delta: s.delta,
        reason: s.reason,
        timestamp: s.timestamp?.toISOString() || new Date().toISOString(),
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(mergedActivity);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
