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
  // Needed so a check-in via Songsue's OWN scanner (bidirectional check-in
  // sync, scanner.service.ts) can walk a student in the same way ActiveCAMT's
  // own scanner would — without these, a mirrored event defaults to this
  // schema's own defaults (walkInsEnabled=false, quota=unlimited), making
  // walk-ins structurally impossible regardless of ActiveCAMT's real settings.
  walkInsEnabled?: boolean | null;
  quota?: number | null;
  quotaWalkIn?: number | null;
}

export interface SyncEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface SyncExternalRegistrationUser {
  email: string;
  studentId?: string | null;
  name: string;
  prefix?: string | null;
  faculty?: string | null;
  major?: string | null;
  phone?: string | null;
  nickname?: string | null;
  image?: string | null;
  religion?: string | null;
  contactChannels?: string | null;
  // Sensitive — mirrors profileSchema's SENSITIVE_FIELDS in api/profile/route.ts.
  // Written unconditionally on account creation even though pdpaConsent stays
  // false (no songsue-native consent has been given yet) — a deliberate product
  // decision to trust ActiveCAMT's own consent, not an oversight. See the audit
  // write in upsertSyncedUser, which records that this happened.
  chronicDiseases?: string | null;
  medicalHistory?: string | null;
  drugAllergies?: string | null;
  foodAllergies?: string | null;
  dietaryRestrictions?: string | null;
  faintingHistory?: boolean | null;
  emergencyMedication?: string | null;
  emergencyContacts?: SyncEmergencyContact[] | null;
}

// Mirrors SENSITIVE_FIELDS in src/app/api/profile/route.ts — kept as a separate
// list (not imported) since that file is a route module, not a shared lib.
const SENSITIVE_SYNC_FIELDS: (keyof SyncExternalRegistrationUser)[] = [
  "chronicDiseases", "medicalHistory", "drugAllergies", "foodAllergies",
  "dietaryRestrictions", "emergencyMedication", "faintingHistory", "emergencyContacts",
];

function isSensitiveProvided(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== "";
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
            walkInsEnabled: payload.walkInsEnabled ?? false,
            quota: payload.quota ?? null,
            quotaWalkIn: payload.quotaWalkIn ?? null,
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
          walkInsEnabled: payload.walkInsEnabled ?? false,
          quota: payload.quota ?? null,
          quotaWalkIn: payload.quotaWalkIn ?? null,
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
   * synced event. Upserts the user by email (creating a real Songsue account on
   * first sight — profileCompleted/pdpaConsent/houseId all unset, but profile
   * AND medical/emergency fields from the payload ARE written; see
   * upsertSyncedUser and SyncExternalRegistrationUser's doc comment for why
   * that's a deliberate PDPA-consent tradeoff, not an oversight). If the email
   * already belongs to an existing, never-completed-onboarding row (e.g. a
   * bare Google sign-in on Songsue with nothing filled in), blank fields on
   * it are backfilled from this payload instead — see
   * backfillIncompleteProfile; a completed profile is never touched. Then
   * upserts the attendance row for the event's single mirrored session. A
   * house is assigned ONLY when the status is "attended" (first check-in) —
   * never at "registered" — same rule Songsue applies to its own real scans;
   * ActiveCAMT's own house never carries over. Throws ActiveCamtSyncError if
   * the event hasn't been synced yet (event sync must land before any
   * registration sync for it).
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
      const { id: userId, created: createdUser, backfilledFields } = await this.upsertSyncedUser(tx, payload.user, ipAddress);

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
          (createdUser
            ? " (created new Songsue account)"
            : backfilledFields.length > 0
              ? ` (backfilled incomplete profile: ${backfilledFields.join(", ")})`
              : ""),
        ipAddress,
      });

      return { userId, eventId: event.id, createdUser, backfilledFields };
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

  // Finds the user by email, or creates an account from the ActiveCAMT payload —
  // including medical/emergency fields, written unconditionally on creation even
  // though pdpaConsent stays false (see SyncExternalRegistrationUser doc comment).
  // NO house — house assignment happens only at first check-in (see
  // ensureHouseAssigned above), never at registration/account-creation sync.
  // onConflictDoNothing + re-read handles a concurrent sync for the same
  // brand-new email racing this insert.
  //
  // An EXISTING row with profileCompleted=true is a student's own finished,
  // authoritative Songsue profile — left completely untouched, same as
  // before. But an existing row with profileCompleted=false (most commonly: a
  // bare Google sign-in that never finished onboarding, created before this
  // student's first ActiveCAMT sync) has nothing worth protecting — leaving
  // it blank just means the student has to retype into Songsue data ActiveCAMT
  // already gave us, which is the exact friction this sync exists to remove.
  // backfillIncompleteProfile below fills in only the fields that are
  // CURRENTLY BLANK on that row, never overwriting a value that's already
  // there (even a partial one the student entered themselves) — INCLUDING
  // medical/emergency fields now (product decision: extend the same "trust
  // ActiveCAMT's own consent" tradeoff account-creation already uses to this
  // backfill path too), each write audited the same way creation's is.
  private static async upsertSyncedUser(
    tx: DBTransaction,
    payload: SyncExternalRegistrationUser,
    ipAddress: string,
  ): Promise<{ id: string; created: boolean; backfilledFields: string[] }> {
    const existing = await tx.query.users.findFirst({
      where: eq(users.email, payload.email),
      columns: {
        id: true, profileCompleted: true, name: true, prefix: true, studentId: true,
        faculty: true, major: true, phone: true, nickname: true, image: true,
        religion: true, contactChannels: true, chronicDiseases: true, medicalHistory: true,
        drugAllergies: true, foodAllergies: true, dietaryRestrictions: true,
        faintingHistory: true, emergencyMedication: true, emergencyContacts: true,
      },
    });

    // studentId and phone are ALSO globally unique (schema.ts) — not just email.
    // A studentId/phone already held by a DIFFERENT existing user would otherwise
    // throw a raw unique-violation and abort the whole sync (onConflictDoNothing
    // below only covers the email target). Drop just the colliding field(s)
    // rather than fail the sync — the synced account still lands correctly by
    // email, which is the actual join key; a stale/reused studentId or phone on
    // another row isn't reason to lose this student's house/attendance credit.
    // Shared by both the insert branch and the incomplete-profile backfill branch
    // below, so computed once up front.
    const studentId = payload.studentId ?? null;
    const phone = payload.phone ?? null;
    const collisions = studentId || phone
      ? await tx.query.users.findMany({
          where: sql`${studentId ? sql`${users.studentId} = ${studentId}` : sql`false`} OR ${phone ? sql`${users.phone} = ${phone}` : sql`false`}`,
          columns: { id: true, studentId: true, phone: true },
        })
      : [];
    const studentIdTaken = studentId != null && collisions.some((u) => u.studentId === studentId && u.id !== existing?.id);
    const phoneTaken = phone != null && collisions.some((u) => u.phone === phone && u.id !== existing?.id);

    if (existing) {
      if (existing.profileCompleted) return { id: existing.id, created: false, backfilledFields: [] };
      const backfilledFields = await this.backfillIncompleteProfile(tx, existing, payload, {
        studentId: studentIdTaken ? null : studentId,
        phone: phoneTaken ? null : phone,
      }, ipAddress);
      return { id: existing.id, created: false, backfilledFields };
    }

    const newId = crypto.randomUUID();
    const inserted = await tx
      .insert(users)
      .values({
        id: newId,
        email: payload.email,
        name: payload.name,
        prefix: payload.prefix ?? null,
        studentId: studentIdTaken ? null : studentId,
        faculty: normalizeFaculty(payload.faculty),
        major: payload.major ?? null,
        phone: phoneTaken ? null : phone,
        nickname: payload.nickname ?? null,
        image: payload.image ?? null,
        religion: payload.religion ?? null,
        contactChannels: payload.contactChannels ?? null,
        chronicDiseases: payload.chronicDiseases ?? null,
        medicalHistory: payload.medicalHistory ?? null,
        drugAllergies: payload.drugAllergies ?? null,
        foodAllergies: payload.foodAllergies ?? null,
        dietaryRestrictions: payload.dietaryRestrictions ?? null,
        faintingHistory: payload.faintingHistory ?? null,
        emergencyMedication: payload.emergencyMedication ?? null,
        emergencyContacts: payload.emergencyContacts ?? null,
        profileCompleted: false,
        pdpaConsent: false,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    if (inserted.length > 0) {
      // PDPA change-trail (field NAMES only, never values) — mirrors the
      // self-onboarding audit write in api/profile/route.ts, but the actor is
      // the sync system, not the data subject, since consent hasn't happened
      // in songsue yet.
      const provided = SENSITIVE_SYNC_FIELDS.filter((f) => isSensitiveProvided(payload[f]));
      if (provided.length > 0) {
        await AuditService.logActionInternal(tx, {
          actorId: SYNC_ACTOR_ID,
          targetId: newId,
          action: `Synced from ActiveCAMT: wrote medical/emergency info without songsue PDPA consent (${provided.join(", ")})`,
          ipAddress,
        });
      }
      return { id: inserted[0].id, created: true, backfilledFields: [] };
    }

    // Lost the insert race — re-read the row the other transaction created.
    const raced = await tx.query.users.findFirst({
      where: eq(users.email, payload.email),
      columns: { id: true },
    });
    if (!raced) throw new Error("USER_UPSERT_RACE_UNRESOLVED");
    return { id: raced.id, created: false, backfilledFields: [] };
  }

  // Fills in fields on an existing, never-completed-onboarding row — never
  // overwrites a value that's already there (even a partial one the student
  // entered themselves), EXCEPT `name`: unconditionally replaced by
  // ActiveCAMT's, since a bare Google sign-in always has SOME name (OAuth
  // profile default) that was never actually chosen for use in Songsue —
  // profileCompleted=false already means nothing on this row has been
  // confirmed here yet. Medical/emergency fields ARE included (product
  // decision: extend the same "trust ActiveCAMT's own consent" tradeoff
  // account-creation already uses to this path too — see
  // SyncExternalRegistrationUser's doc comment), each write audited by the
  // caller the same way creation's is. studentId/phone reuse the same
  // taken/collision check the sibling insert branch uses, passed in already
  // resolved.
  private static async backfillIncompleteProfile(
    tx: DBTransaction,
    existing: {
      id: string; name: string; prefix: string | null; studentId: string | null;
      faculty: string | null; major: string | null; phone: string | null;
      nickname: string | null; image: string | null; religion: string | null;
      contactChannels: string | null; chronicDiseases: string | null;
      medicalHistory: string | null; drugAllergies: string | null;
      foodAllergies: string | null; dietaryRestrictions: string | null;
      faintingHistory: boolean | null; emergencyMedication: string | null;
      emergencyContacts: unknown;
    },
    payload: SyncExternalRegistrationUser,
    resolved: { studentId: string | null; phone: string | null },
    ipAddress: string,
  ): Promise<string[]> {
    const patch: Record<string, unknown> = {};
    const patchedFields: string[] = [];
    const fill = (field: string, existingValue: unknown, next: unknown) => {
      if (existingValue == null || existingValue === "") {
        if (next != null && next !== "") {
          patch[field] = next;
          patchedFields.push(field);
        }
      }
    };

    // Unconditional — see the doc comment above.
    if (payload.name) { patch.name = payload.name; patchedFields.push("name"); }

    fill("prefix", existing.prefix, payload.prefix ?? null);
    fill("studentId", existing.studentId, resolved.studentId);
    fill("faculty", existing.faculty, payload.faculty ? normalizeFaculty(payload.faculty) : null);
    fill("major", existing.major, payload.major ?? null);
    fill("phone", existing.phone, resolved.phone);
    fill("nickname", existing.nickname, payload.nickname ?? null);
    fill("image", existing.image, payload.image ?? null);
    fill("religion", existing.religion, payload.religion ?? null);
    fill("contactChannels", existing.contactChannels, payload.contactChannels ?? null);
    fill("chronicDiseases", existing.chronicDiseases, payload.chronicDiseases ?? null);
    fill("medicalHistory", existing.medicalHistory, payload.medicalHistory ?? null);
    fill("drugAllergies", existing.drugAllergies, payload.drugAllergies ?? null);
    fill("foodAllergies", existing.foodAllergies, payload.foodAllergies ?? null);
    fill("dietaryRestrictions", existing.dietaryRestrictions, payload.dietaryRestrictions ?? null);
    fill("faintingHistory", existing.faintingHistory, payload.faintingHistory ?? null);
    fill("emergencyMedication", existing.emergencyMedication, payload.emergencyMedication ?? null);
    if ((existing.emergencyContacts == null || (Array.isArray(existing.emergencyContacts) && existing.emergencyContacts.length === 0))
      && payload.emergencyContacts && payload.emergencyContacts.length > 0) {
      patch.emergencyContacts = payload.emergencyContacts;
      patchedFields.push("emergencyContacts");
    }

    if (patchedFields.length === 0) return [];

    await tx.update(users).set({ ...patch, updatedAt: new Date() }).where(eq(users.id, existing.id));

    // PDPA change-trail for the sensitive subset — mirrors the account-
    // creation path's own audit write (see upsertSyncedUser's insert branch),
    // field NAMES only, never values.
    const sensitiveBackfilled = patchedFields.filter((f) => (SENSITIVE_SYNC_FIELDS as string[]).includes(f));
    if (sensitiveBackfilled.length > 0) {
      await AuditService.logActionInternal(tx, {
        actorId: SYNC_ACTOR_ID,
        targetId: existing.id,
        action: `Synced from ActiveCAMT: backfilled medical/emergency info without songsue PDPA consent (${sensitiveBackfilled.join(", ")})`,
        ipAddress,
      });
    }

    return patchedFields;
  }
}
