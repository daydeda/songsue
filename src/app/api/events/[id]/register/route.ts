import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users } from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// POST /api/events/[id]/register — One-click registration (FE-05)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const userId = session.user.id!;

    // Validate event exists
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Validate registration deadline if exists
    if (event.registrationCloseTime && new Date() > new Date(event.registrationCloseTime)) {
      return NextResponse.json({ error: "Registration for this event has closed" }, { status: 403 });
    }

    // Validate target audience eligibility
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

    const targetThai = event.targetThai ?? true;
    const targetInternational = event.targetInternational ?? true;
    
    // Fallback: If both targets are false/unchecked, anyone can join!
    const effectiveThai = (!targetThai && !targetInternational) ? true : targetThai;
    const effectiveIntl = (!targetThai && !targetInternational) ? true : targetInternational;
    
    if (isThai && !effectiveThai) {
      return NextResponse.json({ error: "This event is for international students only" }, { status: 403 });
    }
    if (isIntl && !effectiveIntl) {
      return NextResponse.json({ error: "This event is for Thai students only" }, { status: 403 });
    }

    // (Removed strict end time check to allow late registration if event is still visible)

    // Check if already registered
    const existing = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, userId)),
    });

    if (existing) {
      return NextResponse.json({ error: "Already registered for this event" }, { status: 409 });
    }

    // Quota check (Overall)
    if (event.quota !== null && event.quota > 0) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(attendance)
        .where(eq(attendance.eventId, eventId));

      if (currentCount >= event.quota) {
        return NextResponse.json({ error: "Event is full" }, { status: 422 });
      }
    }

    // Cohort Quota check: Thai Students
    if (isThai && event.quotaThai !== null && event.quotaThai > 0) {
      const [{ value: currentThaiCount }] = await db
        .select({ value: count() })
        .from(attendance)
        .innerJoin(users, eq(attendance.studentId, users.id))
        .where(
          and(
            eq(attendance.eventId, eventId),
            sql`substr(${users.studentId}, length(${users.studentId}) - 2, 1) IN ('0', '1', '2', '3', '4')`
          )
        );

      if (currentThaiCount >= event.quotaThai) {
        return NextResponse.json({ error: "Thai student quota is full" }, { status: 422 });
      }
    }

    // Cohort Quota check: International Students
    if (isIntl && event.quotaInternational !== null && event.quotaInternational > 0) {
      const [{ value: currentIntlCount }] = await db
        .select({ value: count() })
        .from(attendance)
        .innerJoin(users, eq(attendance.studentId, users.id))
        .where(
          and(
            eq(attendance.eventId, eventId),
            sql`substr(${users.studentId}, length(${users.studentId}) - 2, 1) = '5'`
          )
        );

      if (currentIntlCount >= event.quotaInternational) {
        return NextResponse.json({ error: "International student quota is full" }, { status: 422 });
      }
    }

    // Register (status = registered, no checkInTime yet)
    await db.insert(attendance).values({
      eventId,
      studentId: userId,
      method: "pre-registered",
      status: "registered",
      checkInTime: null,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/events/[id]/register — Cancel registration
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const userId = session.user.id!;

    // Validate registration and check status/time
    const record = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, userId)),
      with: { event: true }
    });

    if (!record) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Rule 1: Cannot un-register if already attended
    if (record.status === 'attended') {
      return NextResponse.json({ error: "Cannot cancel registration after check-in" }, { status: 403 });
    }

    // Rule 2: Cannot un-register if event is past
    if (record.event && new Date() > new Date(record.event.endTime)) {
      return NextResponse.json({ error: "Cannot cancel registration for past events" }, { status: 403 });
    }

    await db
      .delete(attendance)
      .where(and(eq(attendance.eventId, eventId), eq(attendance.studentId, userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
