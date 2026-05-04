import { auth } from "@/auth";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const eventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  quota: z.number().int().positive().optional(),
  location: z.string().optional(),
  pointsAwarded: z.number().int().min(0).optional(),
  imageUrl: z.string().optional().nullable(),
  walkInsEnabled: z.boolean().optional(),
});

// PUT /api/admin/events/[id] — Update event
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const data = eventUpdateSchema.parse(body);

    const [updated] = await db
      .update(events)
      .set({
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.startTime && { startTime: new Date(data.startTime) }),
        ...(data.endTime && { endTime: new Date(data.endTime) }),
        ...(data.quota !== undefined && { quota: data.quota }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.pointsAwarded !== undefined && { pointsAwarded: data.pointsAwarded }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.walkInsEnabled !== undefined && { walkInsEnabled: data.walkInsEnabled }),
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, event: updated });
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

// DELETE /api/admin/events/[id] — Delete event (soft: archives attendance)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Delete related records manually to avoid FK constraints if cascade isn't applied
    await db.transaction(async (tx) => {
      // 1. Attendance
      const { attendance, scoreHistory } = await import("@/db/schema");
      await tx.delete(attendance).where(eq(attendance.eventId, id));
      // 2. Score History
      await tx.delete(scoreHistory).where(eq(scoreHistory.eventId, id));
      // 3. The Event itself
      const [deleted] = await tx
        .delete(events)
        .where(eq(events.id, id))
        .returning({ id: events.id });
      
      if (!deleted) {
        throw new Error("Event not found");
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    if (error.message === "Event not found") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
