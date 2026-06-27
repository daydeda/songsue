import { auth } from "@/auth";
import { db } from "@/db";
import { events, attendance, eventSessions } from "@/db/schema";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionInputSchema } from "@/lib/event-schema";

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
  individualPointsAwarded: z.number().int().min(0).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  imageUrls: z.array(z.string()).optional().nullable(),
  walkInsEnabled: z.boolean().optional(),
  quotaWalkIn: z.number().int().min(0).optional().nullable(),
  registrationMode: z.enum(["once", "per_session"]).optional(),
  // Multi-day sessions. Omitted/empty → one default session mirroring the
  // event's own start/end is auto-created so every event has ≥1 session.
  sessions: z.array(sessionInputSchema).optional(),
  targetThai: z.boolean().optional(),
  targetInternational: z.boolean().optional(),
  quotaThai: z.number().int().min(0).optional().nullable(),
  quotaInternational: z.number().int().min(0).optional().nullable(),
  allowedRoles: z.array(z.string()).optional().nullable(),
  allowedMajors: z.array(z.string()).optional().nullable(),
  // Restrict the event to the current first-year intake (id-prefix derived).
  firstYearOnly: z.boolean().optional(),
  // Which president role(s) MANAGE this event (club_president / major_president).
  // Separate from allowedRoles (participant visibility) — see GET scoping above.
  managedByRoles: z.array(z.string()).optional().nullable(),
});

// Per-event distinct-attendee counts. This GROUP BY over the whole (event-time-
// growing) attendance table is the costly part of this endpoint, which is polled
// every 8–15s by every admin/scanner client — so cache it at the app layer for 15s.
// The counts are global; the per-president scoping is applied in-memory after. Up to
// 15s of count staleness during a live event is an accepted tradeoff.
const getAttendeeCounts = unstable_cache(
  async () =>
    db
      .select({
        eventId: attendance.eventId,
        count: sql<number>`count(distinct ${attendance.studentId})`,
      })
      .from(attendance)
      .groupBy(attendance.eventId),
  ["admin-events-attendee-counts"],
  { revalidate: 15, tags: ["admin-events-attendee-counts"] },
);

// GET /api/admin/events — List all events with registration counts
export async function GET() {
  try {
    const session = await auth();
    // Scanner-only roles (smo, club_president, major_president) are included here
    // (read-only list) because the QR Scanner's event picker fetches this endpoint;
    // write handlers (POST/PUT/DELETE) deliberately exclude them.
    const myRoles = session?.user?.roles ?? (session?.user?.role ? [session.user.role] : []);
    const isAdminRole = myRoles.some((r) => ["super_admin", "admin", "registration", "organizer", "smo", "club_president", "major_president"].includes(r));
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Event scoping for president roles: club_president / major_president see ONLY
    // events whose managedByRoles is tagged with their role — i.e. events created
    // for them to manage. This is independent of allowedRoles (participant
    // visibility). Staff roles and smo are unscoped (see all). This drives both the
    // admin events page AND the scanner's event picker, which share this endpoint.
    const isStaff = myRoles.some((r) => ["super_admin", "admin", "registration", "organizer"].includes(r));
    const presidentTags = myRoles.filter((r) => ["club_president", "major_president"].includes(r));
    const scopeToPresidentTags = !isStaff && presidentTags.length > 0;

    // Award runs deliberately do NOT live on this polled read path — they run on
    // their own isolated, advisory-locked endpoints (/api/admin/award-check and
    // /api/cron/award-points). Pulling every attendance row in here just to count
    // it is what starved the DB pooler and 504'd the site; this is polled every 8s.

    const list = await db.query.events.findMany({
      orderBy: (events, { desc }) => [desc(events.startTime)],
    });

    // Attendee counts via a single grouped aggregate (DISTINCT students — a multi-day
    // 'once' event has one attended row per day for the same person). Cached for 15s
    // (see getAttendeeCounts) so this whole-table GROUP BY isn't re-run on every poll.
    const counts = await getAttendeeCounts();

    const countByEvent = new Map(counts.map((c) => [c.eventId, Number(c.count)]));

    // Sessions for every event in one query, grouped in memory (O(events) rows).
    // The scanner's day picker and the admin event editor both read these.
    const allSessions = await db.query.eventSessions.findMany({
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.startTime)],
    });
    const sessionsByEvent = new Map<string, typeof allSessions>();
    for (const s of allSessions) {
      const arr = sessionsByEvent.get(s.eventId) ?? [];
      arr.push(s);
      sessionsByEvent.set(s.eventId, arr);
    }

    const eventsWithCount = list.map((e) => ({
      ...e,
      attendeeCount: countByEvent.get(e.id) ?? 0,
      sessions: sessionsByEvent.get(e.id) ?? [],
    }));

    const scoped = scopeToPresidentTags
      ? eventsWithCount.filter((e) =>
          (e.managedByRoles ?? []).some((r) => presidentTags.includes(r))
        )
      : eventsWithCount;

    return NextResponse.json(scoped);
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

    // Sessions: use the provided list, or auto-create one default session
    // mirroring the event's own window so every event has ≥1 session.
    const sessionsInput = (data.sessions && data.sessions.length > 0)
      ? data.sessions
      : [{ title: null, startTime: data.startTime, endTime: data.endTime, quotaWalkIn: data.quotaWalkIn ?? null }];

    const ip = getClientIp(req);

    const event = await db.transaction(async (tx) => {
      const [created] = await tx
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
          individualPointsAwarded: data.individualPointsAwarded ?? 0,
          imageUrl: cover,
          imageUrls: posters,
          walkInsEnabled: data.walkInsEnabled ?? false,
          quotaWalkIn: data.quotaWalkIn,
          registrationMode: data.registrationMode ?? "once",
          targetThai: data.targetThai ?? true,
          targetInternational: data.targetInternational ?? true,
          quotaThai: data.quotaThai,
          quotaInternational: data.quotaInternational,
          allowedRoles: data.allowedRoles && data.allowedRoles.length > 0 ? data.allowedRoles : null,
          allowedMajors: data.allowedMajors && data.allowedMajors.length > 0 ? data.allowedMajors : null,
          firstYearOnly: data.firstYearOnly ?? false,
          managedByRoles: data.managedByRoles && data.managedByRoles.length > 0 ? data.managedByRoles : null,
        })
        .returning();

      await tx.insert(eventSessions).values(
        sessionsInput.map((s, i) => ({
          eventId: created.id,
          title: s.title?.trim() ? s.title.trim() : null,
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
          sortOrder: i,
          quotaWalkIn: s.quotaWalkIn ?? null,
        }))
      );

      // Log the event creation (through the service so the hash chain stays intact)
      await AuditService.logActionInternal(tx, {
        actorId: session.user!.id!,
        action: `Created Event: ${created.title} (${sessionsInput.length} session${sessionsInput.length > 1 ? "s" : ""})`,
        ipAddress: ip,
      });

      return created;
    });

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
