import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
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

    // Check event hasn't ended
    if (new Date() > new Date(event.endTime)) {
      return NextResponse.json({ error: "Event has already ended" }, { status: 422 });
    }

    // Check if already registered
    const existing = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, userId)),
    });

    if (existing) {
      return NextResponse.json({ error: "Already registered for this event" }, { status: 409 });
    }

    // Quota check
    if (event.quota !== null) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(attendance)
        .where(eq(attendance.eventId, eventId));

      if (currentCount >= event.quota) {
        return NextResponse.json({ error: "Event is full" }, { status: 422 });
      }
    }

    // Register (walk-in = false, no QR scan yet)
    await db.insert(attendance).values({
      eventId,
      studentId: userId,
      method: "pre-registered",
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

    await db
      .delete(attendance)
      .where(and(eq(attendance.eventId, eventId), eq(attendance.studentId, userId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
