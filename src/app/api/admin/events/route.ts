import { auth } from "@/auth";
import { db } from "@/db";
import { events, attendance } from "@/db/schema";
import { AuditService } from "@/modules/audit/audit.service";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
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
});

// GET /api/admin/events — List all events with registration counts
export async function GET() {
  try {
    const session = await auth();
    // Scanner-only roles (smo, club_president, major_president) are included here
    // (read-only list) because the QR Scanner's event picker fetches this endpoint;
    // write handlers (POST/PUT/DELETE) deliberately exclude them.
    const isAdminRole = ["super_admin", "admin", "registration", "organizer", "smo", "club_president", "major_president"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Award runs deliberately do NOT live on this polled read path — they run on
    // their own isolated, advisory-locked endpoints (/api/admin/award-check and
    // /api/cron/award-points). Pulling every attendance row in here just to count
    // it is what starved the DB pooler and 504'd the site; this is polled every 8s.

    const list = await db.query.events.findMany({
      orderBy: (events, { desc }) => [desc(events.startTime)],
    });

    // Attendee counts via a single grouped aggregate — returns O(events) rows
    // instead of loading the whole, event-time-growing attendance table into memory.
    const counts = await db
      .select({
        eventId: attendance.eventId,
        count: sql<number>`count(*)`,
      })
      .from(attendance)
      .groupBy(attendance.eventId);

    const countByEvent = new Map(counts.map((c) => [c.eventId, Number(c.count)]));

    const eventsWithCount = list.map((e) => ({
      ...e,
      attendeeCount: countByEvent.get(e.id) ?? 0,
    }));

    return NextResponse.json(eventsWithCount);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/events — Create event
export async function POST(req: Request) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = eventSchema.parse(body);

    // Normalize posters: drop blanks, dedupe-free order preserved. The cover
    // (imageUrl) always mirrors imageUrls[0] so single-image consumers keep working.
    const posters = (data.imageUrls ?? (data.imageUrl ? [data.imageUrl] : []))
      .filter((u): u is string => typeof u === "string" && u.trim() !== "");
    const cover = posters[0] ?? null;

    const [event] = await db
      .insert(events)
      .values({
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        registrationOpenTime: data.registrationOpenTime ? new Date(data.registrationOpenTime) : null,
        registrationCloseTime: data.registrationCloseTime ? new Date(data.registrationCloseTime) : null,
        quota: data.quota,
        location: data.location,
        pointsAwarded: data.pointsAwarded ?? 0,
        imageUrl: cover,
        imageUrls: posters,
        walkInsEnabled: data.walkInsEnabled ?? false,
        quotaWalkIn: data.quotaWalkIn,
        targetThai: data.targetThai ?? true,
        targetInternational: data.targetInternational ?? true,
        quotaThai: data.quotaThai,
        quotaInternational: data.quotaInternational,
        allowedRoles: data.allowedRoles && data.allowedRoles.length > 0 ? data.allowedRoles : null,
      })
      .returning();

    // Broadcast event creation in real-time
    if (event) {
      // Log the event creation (through the service so the hash chain stays intact)
      await AuditService.logAction({
        actorId: session.user.id!,
        action: `Created Event: ${event.title}`,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          req.headers.get("x-real-ip") ||
          "127.0.0.1",
      });
    }

    return NextResponse.json({ success: true, event: event }, { status: 201 });
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
