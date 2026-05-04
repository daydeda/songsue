import { auth } from "@/auth";
import { db } from "@/db";
import { attendance } from "@/db/schema";
import { and, count, eq, lt, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get all attendances for the user
    const userAttendances = await db.query.attendance.findMany({
      where: eq(attendance.studentId, userId),
      with: {
        event: true,
      },
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
    });

    // For each attendance, calculate the rank
    const history = await Promise.all(
      userAttendances.map(async (att) => {
        if (!att.event) return null;

        // Count how many people checked in before or at the same time as this student
        // Using checkInTime for rank. If times are identical, the order might vary slightly but it's the most fair metric.
        const [{ value: rank }] = await db
          .select({ value: count() })
          .from(attendance)
          .where(
            and(
              eq(attendance.eventId, att.eventId),
              lt(attendance.checkInTime, att.checkInTime!)
            )
          );

        return {
          id: att.id,
          eventId: att.eventId,
          eventTitle: att.event.title,
          eventImageUrl: att.event.imageUrl,
          eventQuota: att.event.quota,
          checkInTime: att.checkInTime,
          method: att.method,
          rank: (rank || 0) + 1, // 1st, 2nd, etc.
        };
      })
    );

    return NextResponse.json(history.filter(Boolean));
  } catch (error) {
    console.error("Failed to fetch student history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
