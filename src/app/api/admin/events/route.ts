import { auth } from "@/auth";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { realtimeEmitter } from "@/lib/realtime-emitter";

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  quota: z.number().int().positive().optional(),
  location: z.string().optional(),
  pointsAwarded: z.number().int().min(0).optional(),
  imageUrl: z.string().optional().nullable(),
  walkInsEnabled: z.boolean().optional(),
});

import { checkAndAwardPastEventPoints } from "@/lib/award-points";

// GET /api/admin/events — List all events with registration counts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
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
    if (!session?.user || (session.user as any).role !== "admin") {
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
        quota: data.quota,
        location: data.location,
        pointsAwarded: data.pointsAwarded ?? 0,
        imageUrl: data.imageUrl,
        walkInsEnabled: data.walkInsEnabled ?? false,
      })
      .returning();

    // Broadcast event creation in real-time
    if (event) {
      realtimeEmitter.emit("dashboard_update", {
        type: "event_created",
        event: {
          id: event.id,
          title: event.title,
        }
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
