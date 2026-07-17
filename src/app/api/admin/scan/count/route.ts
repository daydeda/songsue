import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events } from "@/db/schema";
import { and, eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { captureException } from "@/lib/logger";
import { canEnterAdminAny, effectiveRoles, isGlobalRegistrationPosition } from "@/lib/admin-access";
import { EventScopeService } from "@/modules/events/event-scope.service";

// GET /api/admin/scan/count?eventId=<uuid>&sessionId=<uuid>
//
// Returns ONLY an aggregate check-in count for the live scanner display:
//   { checkedIn: number }
//
// Deliberately separate from /api/admin/events/[id]/attendance, which reads the
// full roster INCLUDING medical detail and writes a PDPA audit log on every call —
// far too heavy to poll every few seconds. This endpoint touches no PII and reads
// no medical data, so it needs no audit log and is cheap to poll during an event.
export async function GET(req: Request) {
  try {
    const session = await auth();
    // Mirror the scan POST gate: every scanner-capable role may see the count.
    // Gate on the whole role set so a president whose primary role resolves to a
    // non-entry role (e.g. anusmo) isn't wrongly blocked.
    if (!session?.user || !canEnterAdminAny(effectiveRoles(session.user.role, session.user.roles), session.user.position)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    const sessionId = url.searchParams.get("sessionId");
    // Validate the ids are UUIDs before they reach the eq() filters — an invalid
    // value would otherwise make Postgres throw 22P02 and surface as a 500.
    const uuid = z.string().uuid();
    if (!eventId || !uuid.safeParse(eventId).success) {
      return NextResponse.json({ error: "Valid eventId is required" }, { status: 400 });
    }
    if (sessionId && !uuid.safeParse(sessionId).success) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    // President roles, and a club/major-scoped registration position, may only
    // read events they OWN (ownerClubIds/ownerMajors), mirroring the
    // /api/admin/scan and attendance scoping. Staff and a GLOBAL registration
    // position are unscoped.
    const myRoles = session.user.roles ?? (session.user.role ? [session.user.role] : []);
    const position = session.user.position;
    const isStaff = myRoles.some((r) =>
      ["super_admin", "admin", "registration", "organizer"].includes(r),
    ) || isGlobalRegistrationPosition(myRoles, position);
    const presidentTags = myRoles.filter((r) =>
      ["club_president", "major_president"].includes(r),
    );
    if (!isStaff && (presidentTags.length > 0 || position === "registration")) {
      const ev = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: { ownerClubIds: true, ownerMajors: true },
      });
      const access = await EventScopeService.resolveEventAccess({
        userId: session.user.id!, roles: myRoles, position, isUnscopedStaff: false, hasPresidentTag: presidentTags.length > 0,
      });
      const managed = access.allowed && (access.unscoped || (ev ? EventScopeService.isEventManagedByScope(ev, access.scope) : false));
      if (!managed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Count only students who actually CHECKED IN (status 'attended'), not those
    // who merely pre-registered. Pre-registration writes an attendance row with
    // status 'registered' (method 'pre-registered'); scanning flips it to
    // 'attended'. Without this filter the live "Checked In" card would include
    // no-shows and would not climb as students scan in.
    const [row] = await db
      .select({ value: count() })
      .from(attendance)
      .where(
        sessionId
          ? and(
              eq(attendance.eventId, eventId),
              eq(attendance.sessionId, sessionId),
              eq(attendance.status, "attended"),
            )
          : and(
              eq(attendance.eventId, eventId),
              eq(attendance.status, "attended"),
            ),
      );

    return NextResponse.json(
      { checkedIn: row?.value ?? 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    captureException(error, { route: "GET /api/admin/scan/count" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
