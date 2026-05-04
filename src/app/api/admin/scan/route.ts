import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const scanSchema = z.object({
  qrToken: z.string().uuid(),
  eventId: z.string().uuid(),
  action: z.enum(["scan", "confirm"]).default("scan"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { qrToken, eventId, action } = scanSchema.parse(body);

    // 1. Resolve student
    const student = await db.query.users.findFirst({
      where: eq(users.qrToken, qrToken),
      with: { house: true },
    });

    if (!student) {
      return NextResponse.json(
        { status: "not_found", error: "Student not found in the system." },
        { status: 404 }
      );
    }

    // 2. Resolve event
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // 3. Check attendance record
    const record = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, student.id)),
    });

    // Case A: Student is already registered for the event
    if (record) {
      if (record.status === "attended") {
        return NextResponse.json({
          status: "already_checked_in",
          student: { name: student.name, nickname: student.nickname },
          checkedInAt: record.checkInTime,
        }, { status: 409 });
      }

      // Pre-registered but not attended yet
      if (action === "confirm") {
        await db.update(attendance)
          .set({
            status: "attended",
            checkInTime: new Date(),
            scannedBy: session.user.id,
            // Keep original method (pre-registered)
          })
          .where(eq(attendance.id, record.id));

        return NextResponse.json({
          status: "success",
          student: {
            name: student.name,
            nickname: student.nickname,
            studentId: student.studentId,
            house: student.house?.name ?? "UNASSIGNED",
            houseColor: (student.house as any)?.color ?? "#6366f1",
          },
        });
      }

      // Wait for manual confirmation (Workflow A)
      return NextResponse.json({
        status: "pending_confirmation",
        student: {
          name: student.name,
          nickname: student.nickname,
          studentId: student.studentId,
          house: student.house?.name ?? "UNASSIGNED",
          houseColor: (student.house as any)?.color ?? "#6366f1",
        },
      });
    }

    // Case B: Not registered (Walk-in Workflow B)
    if (event.walkInsEnabled) {
      // Quota check
      if (event.quota !== null) {
        const [{ value: currentCount }] = await db
          .select({ value: count() })
          .from(attendance)
          .where(eq(attendance.eventId, eventId));

        if (currentCount >= event.quota) {
          return NextResponse.json(
            { status: "quota_full", error: "Event is full. Walk-ins cannot be accepted." },
            { status: 422 }
          );
        }
      }

      // Automatically create and mark as attended
      await db.insert(attendance).values({
        eventId: eventId,
        studentId: student.id,
        scannedBy: session.user.id,
        method: "walk-in",
        status: "attended",
        checkInTime: new Date(),
      });

      return NextResponse.json({
        status: "success_walk_in",
        student: {
          name: student.name,
          nickname: student.nickname,
          studentId: student.studentId,
          house: student.house?.name ?? "UNASSIGNED",
          houseColor: (student.house as any)?.color ?? "#6366f1",
        },
      });
    }

    // Walk-ins disabled and not registered
    return NextResponse.json({
      status: "walk_ins_disabled",
      student: { name: student.name, nickname: student.nickname },
      error: "Walk-ins are not enabled for this event and student is not pre-registered.",
    }, { status: 403 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join(", ") 
      }, { status: 400 });
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
