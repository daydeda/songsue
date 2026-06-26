import { auth } from "@/auth";
import { canEnterAdminAny, canGiveIndividualScoreAny, effectiveRoles } from "@/lib/admin-access";
import { ScannerService } from "@/modules/events/scanner.service";
import { EventsService } from "@/modules/events/events.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { captureException } from "@/lib/logger";

// Fail fast instead of hanging to the 300s platform default if the DB pooler stalls.
// Scanning must stay responsive during the event even under load.
export const maxDuration = 20;

const scanSchema = z.object({
  qrToken: z.string(), // Allows fallback IDs as well
  eventId: z.string().uuid(),
  // Which session (day) the check-in counts for. Optional so legacy clients still
  // work — when omitted the server resolves the "current" session for the event.
  sessionId: z.string().uuid().optional(),
  action: z.enum(["scan", "confirm", "score", "lookup"]).default("scan"),
  medsCheckOption: z.string().nullish(),
  // Allow negatives so admins can deduct points (penalties/corrections); 0 is meaningless.
  score: z.number().int().gte(-500).lte(500).refine((n) => n !== 0, "Score cannot be zero").optional(),
  reason: z.string().optional(),
});

export async function POST(req: Request) {
  // Apply IP Rate Limiter. This is an admin-authenticated endpoint on the scanning
  // hot path: a single check-in is 2 requests (scan + confirm), so the limit must be
  // high enough for rapid mass check-in. 300/min ≈ 5 req/s comfortably covers it.
  const ip = getClientIp(req);
  const limiter = rateLimit(ip, 300, 60000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil((limiter.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Gate on the whole role SET, not just the primary role — a president whose
    // primary role resolves to a non-entry role (e.g. anusmo) must still be able to
    // scan. canEnterAdminAny matches the admin-entry roles (incl. scanner-only).
    const roles = effectiveRoles(session.user.role, session.user.roles);
    if (!canEnterAdminAny(roles)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { qrToken, eventId, sessionId, action, medsCheckOption, score, reason } = scanSchema.parse(body);

    // President roles may only scan events they manage (managedByRoles), mirroring
    // the /api/admin/events list + attendance/report scoping. Staff and smo unscoped.
    const isStaff = roles.some((r) => ["super_admin", "admin", "registration", "organizer"].includes(r));
    const presidentTags = roles.filter((r) => ["club_president", "major_president"].includes(r));
    if (!isStaff && presidentTags.length > 0) {
      const ev = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { managedByRoles: true },
      });
      const managed = (ev?.managedByRoles ?? []).some((r) => presidentTags.includes(r));
      if (!managed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // When the client doesn't pin a session, record the check-in against the
    // event's "current" day (window containing now → upcoming → most recent).
    const resolvedSessionId = sessionId ?? (await EventsService.resolveCurrentSessionId(eventId));
    if (!resolvedSessionId) {
      return NextResponse.json(
        { status: "not_found", error: "Event has no sessions configured." },
        { status: 404 }
      );
    }

    // Individual scoring is NOT part of the scanner-only president roles: they may
    // check in attendees but must not award/deduct individual points. smo keeps it.
    // The "lookup" action (score-mode student resolve) is a read-only prelude to a
    // score, so block it here too — otherwise these roles could still use score UI.
    if ((action === "score" || action === "lookup") && !canGiveIndividualScoreAny(roles)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delegate business operation to ScannerService
    const result = await ScannerService.processScan({
      qrToken,
      eventId,
      sessionId: resolvedSessionId,
      action,
      medsCheckOption,
      score,
      reason,
      actorId: session.user.id!,
      actorRole: session.user.role || "",
      ipAddress: ip,
    });

    // Map service domain statuses to HTTP status codes
    if (result.status === "not_found") {
      return NextResponse.json(
        { status: result.status, error: result.error },
        { status: 404 }
      );
    }

    if (result.status === "already_checked_in") {
      return NextResponse.json(
        {
          status: result.status,
          student: result.student,
          checkedInAt: result.checkedInAt,
        },
        { status: 409 }
      );
    }

    if (result.status === "quota_full") {
      return NextResponse.json(
        { status: result.status, error: result.error },
        { status: 422 }
      );
    }

    if (result.status === "not_registered") {
      return NextResponse.json(
        {
          status: result.status,
          student: result.student,
          error: result.error,
        },
        { status: 422 }
      );
    }

    if (result.status === "walk_ins_disabled") {
      return NextResponse.json(
        {
          status: result.status,
          student: result.student,
          error: result.error,
        },
        { status: 403 }
      );
    }

    // Success outcomes (success, success_walk_in, pending_confirmation)
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") 
        },
        { status: 400 }
      );
    }
    captureException(error, { route: "POST /api/admin/scan" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Manual search fires per keystroke; allow a higher ceiling than the default.
  const ip = getClientIp(req);
  const limiter = rateLimit(ip, 120, 60000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil((limiter.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Gate on the whole role SET, not just the primary role — a president whose
    // primary role resolves to a non-entry role (e.g. anusmo) must still be able to
    // scan. canEnterAdminAny matches the admin-entry roles (incl. scanner-only).
    const roles = effectiveRoles(session.user.role, session.user.roles);
    if (!canEnterAdminAny(roles)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Search query too short" }, { status: 400 });
    }

    // Delegate query search to ScannerService
    const results = await ScannerService.searchStudents(query);
    return NextResponse.json(results);
  } catch (error) {
    captureException(error, { route: "GET /api/admin/scan" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
