import type { Session } from "next-auth";
import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { effectiveRoles } from "@/lib/admin-access";
import { deductIndividualPoints } from "@/lib/award-individual-points";
import { APPLY_STRIKES_ROLES, NO_SHOW_PENALTY_MAX, NO_SHOW_PENALTY_MIN, NO_SHOW_PENALTY_POINTS, NO_SHOW_STRIKE_THRESHOLD } from "@/lib/strikes";
import { revalidateLeaderboards } from "@/lib/leaderboard-cache";

// Students holding a 'registered' attendance row for this event with NO
// 'attended' row anywhere in the event — i.e. they signed up and never checked
// in on any session. Plain two-query set-difference (not a SQL subquery) to
// match this codebase's existing straightforward query style.
async function findNoShowStudentIds(eventId: string): Promise<string[]> {
  const attendedRows = await db
    .selectDistinct({ studentId: attendance.studentId })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.status, "attended")));
  const attendedIds = new Set(attendedRows.map((r) => r.studentId));

  const registeredRows = await db
    .selectDistinct({ studentId: attendance.studentId })
    .from(attendance)
    .where(and(eq(attendance.eventId, eventId), eq(attendance.status, "registered")));

  return registeredRows.map((r) => r.studentId).filter((id) => !attendedIds.has(id));
}

async function loadEventAndGate(eventId: string, session: Session | null) {
  const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
  if (!session?.user || !myRoles.some((r) => (APPLY_STRIKES_ROLES as readonly string[]).includes(r))) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { id: true, title: true, endTime: true },
  });
  if (!event) {
    return { error: NextResponse.json({ error: "Event not found" }, { status: 404 }) };
  }
  if (new Date() < new Date(event.endTime)) {
    return { error: NextResponse.json({ error: "Cannot apply strikes before the event has ended" }, { status: 403 }) };
  }

  return { event };
}

// GET — preview the no-show roster before an organizer confirms strikes.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: eventId } = await params;
    const gated = await loadEventAndGate(eventId, session);
    if (gated.error) return gated.error;

    const noShowIds = await findNoShowStudentIds(eventId);
    if (noShowIds.length === 0) {
      return NextResponse.json({ students: [] });
    }

    const students = await db.query.users.findMany({
      where: inArray(users.id, noShowIds),
      columns: { id: true, name: true, nickname: true, studentId: true, noShowCount: true },
    });

    return NextResponse.json({ students });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST — organizer-confirmed action: strike every current no-show for this
// event. Re-running is safe (idempotent): a student's attendance rows only
// leave 'registered' once, so a second run finds nothing left to strike for
// them. Each student is processed with its own guarded UPDATE so two
// concurrent applies can't double-strike the same student.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: eventId } = await params;
    const gated = await loadEventAndGate(eventId, session);
    if (gated.error) return gated.error;
    const event = gated.event!;

    // Staff applying the strike may override the default penalty, bounded so a
    // typo can't wipe out a student's points or exceed the published rubric ceiling.
    const body = await req.json().catch(() => ({}));
    const requestedPoints = Number(body?.points);
    const penaltyPoints = Number.isInteger(requestedPoints) ? requestedPoints : NO_SHOW_PENALTY_POINTS;
    if (penaltyPoints < NO_SHOW_PENALTY_MIN || penaltyPoints > NO_SHOW_PENALTY_MAX) {
      return NextResponse.json(
        { error: `points must be between ${NO_SHOW_PENALTY_MIN} and ${NO_SHOW_PENALTY_MAX}` },
        { status: 400 }
      );
    }

    const noShowIds = await findNoShowStudentIds(eventId);
    if (noShowIds.length === 0) {
      return NextResponse.json({ struck: 0, blocked: 0, pointsDeducted: 0 });
    }

    const candidates = await db.query.users.findMany({
      where: inArray(users.id, noShowIds),
      columns: { id: true, name: true, houseId: true, points: true, noShowCount: true, registrationBlocked: true },
    });

    const ipAddress = getClientIp(req);
    let struck = 0;
    let blocked = 0;
    let pointsDeducted = 0;

    await db.transaction(async (tx) => {
      for (const student of candidates) {
        // Guarded flip: only rows still 'registered' for THIS student+event move
        // to 'no_show'. Zero rows back means another concurrent apply (or a
        // late scan) already resolved this student — skip them entirely so
        // they aren't double-struck.
        const flipped = await tx
          .update(attendance)
          .set({ status: "no_show" })
          .where(and(
            eq(attendance.eventId, eventId),
            eq(attendance.studentId, student.id),
            eq(attendance.status, "registered"),
          ))
          .returning({ id: attendance.id });
        if (flipped.length === 0) continue;

        const newNoShowCount = student.noShowCount + 1;
        const newBlocked = student.registrationBlocked || newNoShowCount >= NO_SHOW_STRIKE_THRESHOLD;

        await tx
          .update(users)
          .set({ noShowCount: newNoShowCount, registrationBlocked: newBlocked })
          .where(eq(users.id, student.id));

        const { newPoints } = await deductIndividualPoints(tx, {
          studentId: student.id,
          houseId: student.houseId,
          eventId,
          points: penaltyPoints,
          reason: `Deducted ${penaltyPoints} points: no-show strike ${newNoShowCount}/${NO_SHOW_STRIKE_THRESHOLD} at event "${event.title}"`,
        });

        await AuditService.logActionInternal(tx, {
          actorId: session!.user!.id!,
          targetId: student.id,
          action: `No-show strike ${newNoShowCount}/${NO_SHOW_STRIKE_THRESHOLD} for event "${event.title}" (${eventId}); deducted ${penaltyPoints} points` +
            (newBlocked && !student.registrationBlocked ? "; registration blocked" : ""),
          ipAddress,
        });

        struck += 1;
        pointsDeducted += student.points - newPoints;
        if (newBlocked && !student.registrationBlocked) blocked += 1;
      }
    });

    // Bust the cached leaderboard so the deduction shows up on the next poll
    // instead of waiting out the cache TTL.
    if (struck > 0) {
      revalidateLeaderboards();
    }

    return NextResponse.json({ struck, blocked, pointsDeducted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
