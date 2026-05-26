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

    const { forms, formSubmissions } = await import("@/db/schema");

    // For each attendance, calculate the rank
    const history = await Promise.all(
      userAttendances.map(async (att) => {
        if (!att.event) return null;

        // Count how many people checked in before or at the same time as this student
        const [{ value: rank }] = await db
          .select({ value: count() })
          .from(attendance)
          .where(
            and(
              eq(attendance.eventId, att.eventId),
              lt(attendance.checkInTime, att.checkInTime!)
            )
          );

        // Check if there is an evaluation form for the event
        const formObj = await db.query.forms.findFirst({
          where: eq(forms.eventId, att.eventId),
        });

        let formStatus: "none" | "available" | "submitted" | "closed" = "none";
        let formId: string | null = null;
        let formPoints = 0;

        if (formObj) {
          formId = formObj.id;
          formPoints = formObj.pointsAwarded ?? 0;
          
          const sub = await db.query.formSubmissions.findFirst({
            where: and(
              eq(formSubmissions.formId, formObj.id),
              eq(formSubmissions.studentId, userId)
            ),
          });
          
          if (sub) {
            formStatus = "submitted";
          } else if (!formObj.isActive) {
            formStatus = "closed";
          } else {
            formStatus = "available";
          }
        }

        return {
          id: att.id,
          eventId: att.eventId,
          eventTitle: att.event.title,
          eventImageUrl: att.event.imageUrl,
          eventQuota: att.event.quota,
          eventStartTime: att.event.startTime,
          eventEndTime: att.event.endTime,
          checkInTime: att.checkInTime,
          method: att.method,
          rank: (rank || 0) + 1, // 1st, 2nd, etc.
          formStatus,
          formId,
          formPoints,
        };
      })
    );

    return NextResponse.json(history.filter(Boolean));
  } catch (error) {
    console.error("Failed to fetch student history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
