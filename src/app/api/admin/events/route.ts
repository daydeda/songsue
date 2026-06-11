import { auth } from "@/auth";
import { db } from "@/db";
import { events } from "@/db/schema";
import { AuditService } from "@/modules/audit/audit.service";
import { eq } from "drizzle-orm";
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
  walkInsEnabled: z.boolean().optional(),
  quotaWalkIn: z.number().int().min(0).optional().nullable(),
  targetThai: z.boolean().optional(),
  targetInternational: z.boolean().optional(),
  quotaThai: z.number().int().min(0).optional().nullable(),
  quotaInternational: z.number().int().min(0).optional().nullable(),
  allowedRoles: z.array(z.string()).optional().nullable(),
});

import { checkAndAwardPastEventPoints } from "@/lib/award-points";

// GET /api/admin/events — List all events with registration counts
export async function GET() {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Automatically check and award past event points
    await checkAndAwardPastEventPoints();

    const list = await db.query.events.findMany({
      orderBy: (events, { desc }) => [desc(events.startTime)],
      with: {
        attendances: true,
      }
    });

    // Map to include count
    const eventsWithCount = list.map(e => ({
      ...e,
      attendeeCount: e.attendances.length,
      // Remove the full attendances array to keep response small
      attendances: undefined 
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
        imageUrl: data.imageUrl,
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
