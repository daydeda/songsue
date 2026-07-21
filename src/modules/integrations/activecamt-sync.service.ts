import { db } from "@/db";
import { attendance, events, eventSessions, users } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AuditService } from "@/modules/audit/audit.service";
import { HousesService } from "@/modules/houses/houses.service";
import { normalizeFaculty } from "@/lib/faculties";

// Identifies the sending system for events.externalSource — the only value in
// use today, but kept as a named constant rather than inlined so a second
// integration source doesn't have to hunt down every string literal.
export const ACTIVECAMT_SOURCE = "activecamt";

// Actor id recorded on audit rows written by this service. Deliberately not a
// real users.id (audit_logs.actorId has no FK — see schema.ts) since there is
// no staff session behind these service-to-service calls.
const SYNC_ACTOR_ID = "system:activecamt-sync";

type DBTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface UpsertExternalEventPayload {
  externalId: string;
  title: string;
  description?: string | null;
  startTime: string | Date;
  endTime: string | Date;
  location?: string | null;
  pointsAwarded?: number | null;
  individualPointsAwarded?: number | null;
}

export interface SyncExternalRegistrationUser {
  email: string;
  studentId?: string | null;
  name: string;
  prefix?: string | null;
  faculty?: string | null;
  major?: string | null;
  phone?: string | null;
}

export interface SyncExternalRegistrationPayload {
  externalEventId: string;
  user: SyncExternalRegistrationUser;
  status: "registered" | "attended" | "cancelled";
}

export class ActiveCamtSyncError extends Error {}

export class ActiveCamtSyncService {
  /**
   * Upserts a mirrored event by (externalSource, externalId) — see the unique
   * partial index on events. On first insert, also creates the single
   * eventSessions row every event needs for attendance.sessionId to attach to.
   * On update, patches only the fields ActiveCAMT owns; winnerAwardedAt (Songsue's
   * own award-cron bookkeeping) is never touched by either branch.
   */
  static async upsertExternalEvent(payload: UpsertExternalEventPayload, ipAddress: string) {
    const startTime = new Date(payload.startTime);
    const endTime = new Date(payload.endTime);

    return await db.transaction(async (tx) => {
      const existing = await tx.query.events.findFirst({
        where: and(eq(events.externalSource, ACTIVECAMT_SOURCE), eq(events.externalId, payload.externalId)),
        columns: { id: true },
      });

      if (existing) {
        await tx
          .update(events)
          .set({
            title: payload.title,
            description: payload.description ?? null,
            startTime,
            endTime,
            location: payload.location ?? null,
            pointsAwarded: payload.pointsAwarded ?? 0,
            individualPointsAwarded: payload.individualPointsAwarded ?? 0,
            updatedAt: new Date(),
          })
          .where(eq(events.id, existing.id));

        // Keep the mirrored session's span in sync with the event on update —
        // a synced event has exactly one session (no per-day schedule concept
        // crosses the sync boundary).
        await tx
          .update(eventSessions)
          .set({ startTime, endTime, updatedAt: new Date() })
          .where(eq(eventSessions.eventId, existing.id));

        await AuditService.logActionInternal(tx, {
          actorId: SYNC_ACTOR_ID,
          targetId: existing.id,
          action: `Synced from ActiveCAMT: updated mirrored event ${existing.id} ` +
            `(pointsAwarded=${payload.pointsAwarded ?? 0}, individualPointsAwarded=${payload.individualPointsAwarded ?? 0})`,
          ipAddress,
        });

        return { id: existing.id, created: false };
      }

      // ON CONFLICT DO NOTHING on the (externalSource, externalId) unique
      // partial index closes the race between two concurrent first-time syncs
      // for the same event (both passing the findFirst null-check above) —
      // the loser re-reads the winner's row instead of throwing a 500.
      const inserted = await tx
        .insert(events)
        .values({
          title: payload.title,
          description: payload.description ?? null,
          startTime,
          endTime,
          location: payload.location ?? null,
          pointsAwarded: payload.pointsAwarded ?? 0,
          individualPointsAwarded: payload.individualPointsAwarded ?? 0,
          externalSource: ACTIVECAMT_SOURCE,
          externalId: payload.externalId,
        })
        // The unique index is PARTIAL (WHERE external_id IS NOT NULL) — Postgres's
        // ON CONFLICT arbiter inference requires the predicate to be repeated here,
        // or it can't match the index at all ("no unique or exclusion constraint
        // matching the ON CONFLICT specification").
        .onConflictDoNothing({
          target: [events.externalSource, events.externalId],
          where: sql`${events.externalId} IS NOT NULL`,
        })
        .returning({ id: events.id });

      if (inserted.length === 0) {
        const raced = await tx.query.events.findFirst({
          where: and(eq(events.externalSource, ACTIVECAMT_SOURCE), eq(events.externalId, payload.externalId)),
          columns: { id: true },
        });
        if (!raced) throw new Error("EVENT_UPSERT_RACE_UNRESOLVED");
        return { id: raced.id, created: false };
      }

      await tx.insert(eventSessions).values({
        eventId: inserted[0].id,
        startTime,
        endTime,
        sortOrder: 0,
      });

      await AuditService.logActionInternal(tx, {
        actorId: SYNC_ACTOR_ID,
        targetId: inserted[0].id,
        action: `Synced from ActiveCAMT: created mirrored event ${inserted[0].id} ` +
          `(pointsAwarded=${payload.pointsAwarded ?? 0}, individualPointsAwarded=${payload.individualPointsAwarded ?? 0})`,
        ipAddress,
      });

      return { id: inserted[0].id, created: true };
    });
  }

  /**
   * Mirrors one student's registration/attendance status onto a previously
   * synced event. Upserts the user by email (creating a real, PDPA-minimal
   * Songsue account on first sight — profileCompleted/pdpaConsent/houseId all
   * unset, no medical fields ever touched), then upserts the attendance row
   * for the event's single mirrored session. A house is assigned ONLY when
   * the status is "attended" (first check-in) — never at "registered" — same
   * rule Songsue applies to its own real scans; ActiveCAMT's own house never
   * carries over. Throws ActiveCamtSyncError if the event hasn't been synced
   * yet (event sync must land before any registration sync for it).
   */
  static async syncExternalRegistration(payload: SyncExternalRegistrationPayload, ipAddress: string) {
    const event = await db.query.events.findFirst({
      where: and(eq(events.externalSource, ACTIVECAMT_SOURCE), eq(events.externalId, payload.externalEventId)),
      columns: { id: true },
    });
    if (!event) {
      throw new ActiveCamtSyncError("EXTERNAL_EVENT_NOT_SYNCED");
    }

    const session = await db.query.eventSessions.findFirst({
      where: eq(eventSessions.eventId, event.id),
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.startTime)],
      columns: { id: true },
    });
    if (!session) {
      throw new ActiveCamtSyncError("EXTERNAL_EVENT_HAS_NO_SESSION");
    }

    return await db.transaction(async (tx) => {
      const { id: userId, created: createdUser } = await this.upsertSyncedUser(tx, payload.user);

      if (payload.status === "cancelled") {
        await tx
          .delete(attendance)
          .where(and(eq(attendance.sessionId, session.id), eq(attendance.studentId, userId)));
      } else {
        const checkInTime = payload.status === "attended" ? new Date() : null;
        await tx
          .insert(attendance)
          .values({
            eventId: event.id,
            sessionId: session.id,
            studentId: userId,
            status: payload.status,
            method: "activecamt-sync",
            checkInTime,
          })
          .onConflictDoUpdate({
            target: [attendance.sessionId, attendance.studentId],
            set: { status: payload.status, method: "activecamt-sync", checkInTime },
          });

        // Houses are assigned at FIRST CHECK-IN only (never at registration/sync
        // time) — same rule as a real in-Songsue scan (ScannerService.
        // ensureHouseAssigned). A synced "registered" status must leave houseId
        // untouched; only "attended" triggers assignment.
        if (payload.status === "attended") {
          await this.ensureHouseAssigned(tx, userId, payload.user.faculty);
        }
      }

      await AuditService.logActionInternal(tx, {
        actorId: SYNC_ACTOR_ID,
        targetId: userId,
        action: `Synced from ActiveCAMT: attendance ${payload.status} for event ${event.id}` +
          (createdUser ? " (created new Songsue account)" : ""),
        ipAddress,
      });

      return { userId, eventId: event.id, createdUser };
    });
  }

  // Assigns a house at FIRST CHECK-IN only — mirrors ScannerService.
  // ensureHouseAssigned exactly (same race-safe WHERE house_id IS NULL guard,
  // no advisory lock needed since the guard itself makes concurrent assignment
  // safe). Called only when a synced attendance row transitions to "attended";
  // "registered" syncs must never touch houseId.
  private static async ensureHouseAssigned(
    tx: DBTransaction,
    userId: string,
    faculty: string | null | undefined,
  ): Promise<void> {
    const current = await tx.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { houseId: true },
    });
    if (current?.houseId) return;

    const houseId = await HousesService.pickBalancedHouseIdForFaculty(faculty, tx);
    if (houseId) {
      await tx
        .update(users)
        .set({ houseId, updatedAt: new Date() })
        .where(and(eq(users.id, userId), isNull(users.houseId)));
    }
  }

  // Finds the user by email, or creates a minimal PDPA-safe account with NO
  // house — house assignment happens only at first check-in (see
  // ensureHouseAssigned above), never at registration/account-creation sync.
  // onConflictDoNothing + re-read handles a concurrent sync for the same
  // brand-new email racing this insert.
  private static async upsertSyncedUser(
    tx: DBTransaction,
    payload: SyncExternalRegistrationUser,
  ): Promise<{ id: string; created: boolean }> {
    const existing = await tx.query.users.findFirst({
      where: eq(users.email, payload.email),
      columns: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    // studentId and phone are ALSO globally unique (schema.ts) — not just email.
    // onConflictDoNothing below only covers the email target, so a studentId/phone
    // already held by a DIFFERENT existing user would otherwise throw a raw
    // unique-violation and abort the whole sync. Drop just the colliding field(s)
    // rather than fail the sync — the synced account still lands correctly by
    // email, which is the actual join key; a stale/reused studentId or phone on
    // another row isn't reason to lose this student's house/attendance credit.
    const studentId = payload.studentId ?? null;
    const phone = payload.phone ?? null;
    const collisions = studentId || phone
      ? await tx.query.users.findMany({
          where: sql`${studentId ? sql`${users.studentId} = ${studentId}` : sql`false`} OR ${phone ? sql`${users.phone} = ${phone}` : sql`false`}`,
          columns: { studentId: true, phone: true },
        })
      : [];
    const studentIdTaken = studentId != null && collisions.some((u) => u.studentId === studentId);
    const phoneTaken = phone != null && collisions.some((u) => u.phone === phone);

    const inserted = await tx
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: payload.email,
        name: payload.name,
        prefix: payload.prefix ?? null,
        studentId: studentIdTaken ? null : studentId,
        faculty: normalizeFaculty(payload.faculty),
        major: payload.major ?? null,
        phone: phoneTaken ? null : phone,
        profileCompleted: false,
        pdpaConsent: false,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    if (inserted.length > 0) return { id: inserted[0].id, created: true };

    // Lost the insert race — re-read the row the other transaction created.
    const raced = await tx.query.users.findFirst({
      where: eq(users.email, payload.email),
      columns: { id: true },
    });
    if (!raced) throw new Error("USER_UPSERT_RACE_UNRESOLVED");
    return { id: raced.id, created: false };
  }
}
