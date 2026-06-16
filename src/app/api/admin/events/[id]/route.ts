import { auth } from "@/auth";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AuditService } from "@/modules/audit/audit.service";

const eventUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  registrationOpenTime: z.string().datetime().optional().nullable(),
  registrationCloseTime: z.string().datetime().optional().nullable(),
  quota: z.number().int().min(0).optional().nullable(),
  location: z.string().optional().nullable(),
  pointsAwarded: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
  walkInsEnabled: z.boolean().optional(),
  quotaWalkIn: z.number().int().min(0).optional().nullable(),
  targetThai: z.boolean().optional(),
  targetInternational: z.boolean().optional(),
  quotaThai: z.number().int().min(0).optional().nullable(),
  quotaInternational: z.number().int().min(0).optional().nullable(),
  allowedRoles: z.array(z.string()).optional().nullable(),
  allowedMajors: z.array(z.string()).optional().nullable(),
});

// PUT /api/admin/events/[id] — Update event
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const data = eventUpdateSchema.parse(body);

    // When posters are provided, normalize them and keep the imageUrl cover in
    // sync with imageUrls[0]. If only the legacy imageUrl is sent, fall back to it.
    let posters: string[] | undefined;
    if (data.imageUrls !== undefined) {
      posters = (data.imageUrls ?? [])
        .filter((u): u is string => typeof u === "string" && u.trim() !== "");
    }
    const coverFromPosters = posters !== undefined ? (posters[0] ?? null) : undefined;

    const [updated] = await db
      .update(events)
      .set({
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.startTime && { startTime: new Date(data.startTime) }),
        ...(data.endTime && { endTime: new Date(data.endTime) }),
        ...(data.registrationOpenTime !== undefined && {
            registrationOpenTime: data.registrationOpenTime ? new Date(data.registrationOpenTime) : null
        }),
        ...(data.registrationCloseTime !== undefined && {
            registrationCloseTime: data.registrationCloseTime ? new Date(data.registrationCloseTime) : null
        }),
        ...(data.quota !== undefined && { quota: data.quota }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.pointsAwarded !== undefined && { pointsAwarded: data.pointsAwarded }),
        ...(posters !== undefined
          ? { imageUrls: posters, imageUrl: coverFromPosters }
          : (data.imageUrl !== undefined && { imageUrl: data.imageUrl })),
        ...(data.walkInsEnabled !== undefined && { walkInsEnabled: data.walkInsEnabled }),
        ...(data.quotaWalkIn !== undefined && { quotaWalkIn: data.quotaWalkIn }),
        ...(data.targetThai !== undefined && { targetThai: data.targetThai }),
        ...(data.targetInternational !== undefined && { targetInternational: data.targetInternational }),
        ...(data.quotaThai !== undefined && { quotaThai: data.quotaThai }),
        ...(data.quotaInternational !== undefined && { quotaInternational: data.quotaInternational }),
        ...(data.allowedRoles !== undefined && {
          allowedRoles: data.allowedRoles && data.allowedRoles.length > 0 ? data.allowedRoles : null
        }),
        ...(data.allowedMajors !== undefined && {
          allowedMajors: data.allowedMajors && data.allowedMajors.length > 0 ? data.allowedMajors : null
        }),
        updatedAt: new Date(),
      })
      .where(eq(events.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Log the event update (through the service so the hash chain stays intact)
    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Updated Event: ${updated.title}`,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1",
    });

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
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
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
        .returning({ id: events.id, title: events.title });
      
      if (!deleted) {
        throw new Error("Event not found");
      }

      // 4. Log the deletion in audit trail (through the service to keep the chain intact)
      await AuditService.logActionInternal(tx, {
        actorId: session.user!.id!,
        action: `Deleted Event: ${deleted.title} (${deleted.id})`,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          req.headers.get("x-real-ip") ||
          "127.0.0.1",
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(error);
    if (error instanceof Error && error.message === "Event not found") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
