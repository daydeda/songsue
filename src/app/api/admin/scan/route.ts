import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const scanSchema = z.object({
  // FE-13: The QR code now contains a qrToken (UUID), not the raw user ID
  qrToken: z.string().uuid(),
  eventId: z.string().uuid(),
  isWalkIn: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = scanSchema.parse(body);

    // Resolve qrToken → student record
    const student = await db.query.users.findFirst({
      where: eq(users.qrToken, data.qrToken),
      with: { house: true },
    });

    if (!student) {
      return NextResponse.json(
        { status: "not_found", error: "QR token is invalid or student not registered in the system." },
        { status: 404 }
      );
    }

    // Get event and validate it exists
    const currentEvent = await db.query.events.findFirst({
      where: eq(events.id, data.eventId),
    });

    if (!currentEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // FE-15 Case C: Already checked in?
    const existingAttendance = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.eventId, data.eventId),
        eq(attendance.studentId, student.id)
      ),
    });

    if (existingAttendance) {
      return NextResponse.json(
        {
          status: "already_checked_in",
          checkedInAt: existingAttendance.checkInTime,
          student: { name: student.name, nickname: student.nickname },
        },
        { status: 409 }
      );
    }

    // FE-17: Quota check for walk-in (and all registrations)
    if (currentEvent.quota !== null) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(attendance)
        .where(eq(attendance.eventId, data.eventId));

      if (currentCount >= currentEvent.quota) {
        return NextResponse.json(
          { status: "quota_full", error: "Event has reached maximum capacity." },
          { status: 422 }
        );
      }
    }

    // FE-15 Case B: Not registered (walk-in)
    if (!student.profileCompleted) {
      return NextResponse.json(
        {
          status: "walk_in_required",
          student: { id: student.id, name: student.name, nickname: student.nickname },
          error: "Student has not pre-registered for this event.",
        },
        { status: 200 }
      );
    }

    // FE-15 Case A: Check-in confirmed
    await db.insert(attendance).values({
      eventId: data.eventId,
      studentId: student.id,
      scannedBy: session.user.id,
      method: data.isWalkIn ? "walk-in" : "qr",
    });

    return NextResponse.json({
      status: "success",
      student: {
        name: student.name,
        nickname: student.nickname,
        house: student.house?.name ?? "UNASSIGNED",
        houseColor: (student.house as any)?.color ?? "#6366f1",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Manual fallback check-in by studentId or name (FE-16)
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Search query too short" }, { status: 400 });
    }

    const results = await db.query.users.findMany({
      where: (users, { or, like }) =>
        or(
          like(users.studentId, `%${query}%`),
          like(users.name, `%${query}%`),
          like(users.nickname, `%${query}%`)
        ),
      columns: {
        id: true,
        studentId: true,
        name: true,
        nickname: true,
        houseId: true,
        qrToken: true,
      },
      with: { house: true },
      limit: 10,
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
