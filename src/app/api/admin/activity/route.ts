import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, scoreHistory } from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recentCheckins = await db.query.attendance.findMany({
      limit: 100, // Show more for "View All"
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
        house: { columns: { name: true, color: true } },
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
