import { auth } from "@/auth";
import { db } from "@/db";
import { attendance } from "@/db/schema";
import { and, count, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const userAttendances = await db.query.attendance.findMany({
      where: eq(attendance.studentId, userId),
      with: { event: true },
      orderBy: (a, { desc }) => [desc(a.checkInTime)],
    });

    const { forms, formSubmissions } = await import("@/db/schema");

    const history = await Promise.all(
      userAttendances.map(async (att) => {
        if (!att.event) return null;

        // Rank = the order this student physically checked in (QR scan or walk-in
        // scan), among everyone who attended this event. check_in_time is only set at
        // scan-in, so a student who has registered but NOT yet checked in has no rank
        // — we leave it null rather than showing a misleading "rank 1". Counting rows
        // with an earlier check_in_time naturally ignores not-yet-attended rows, whose
        // check_in_time is null (NULL comparisons are never true in SQL).
        let rank: number | null = null;
        if (att.checkInTime) {
          const [{ value: earlier }] = await db
            .select({ value: count() })
            .from(attendance)
            .where(
              and(
                eq(attendance.eventId, att.eventId),
                lt(attendance.checkInTime, att.checkInTime)
              )
            );
          rank = (earlier || 0) + 1; // 1st, 2nd, … to physically check in
        }

        // All forms for this event (S-type excluded — students never see skill tests)
        const eventForms = await db.query.forms.findMany({
          where: eq(forms.eventId, att.eventId),
          orderBy: (f, { asc }) => [asc(f.sortOrder), asc(f.createdAt)],
        });

        const studentForms = await Promise.all(
          eventForms
            .filter((f) => f.formType !== "S")
            .map(async (formObj) => {
              const sub = await db.query.formSubmissions.findFirst({
                where: and(
                  eq(formSubmissions.formId, formObj.id),
                  eq(formSubmissions.studentId, userId)
                ),
              });

              let formStatus: "available" | "submitted" | "closed";
              if (sub) {
                formStatus = "submitted";
              } else if (!formObj.isActive) {
                formStatus = "closed";
              } else {
                formStatus = "available";
              }

              return {
                id: formObj.id,
                formType: formObj.formType,
                title: formObj.title,
                sortOrder: formObj.sortOrder,
                formStatus,
                formPoints: formObj.pointsAwarded ?? 0,
              };
            })
        );

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
          rank, // check-in order; null when registered but not yet checked in
          forms: studentForms,
        };
      })
    );

    return NextResponse.json(history.filter(Boolean));
  } catch (error) {
    console.error("Failed to fetch student history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
