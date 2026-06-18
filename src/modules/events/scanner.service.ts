import { db } from "@/db";
import { attendance, users, houses, scoreHistory, eventSessions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { UsersService } from "../users/users.service";
import { EventsService } from "./events.service";
import { AuditService } from "../audit/audit.service";
import { canGiveIndividualScore } from "@/lib/admin-access";

type ResolvedStudent = NonNullable<Awaited<ReturnType<typeof UsersService.resolveStudentByToken>>>;

export interface ScanResult {
  status: "success" | "success_walk_in" | "pending_confirmation" | "already_checked_in" | "not_found" | "quota_full" | "walk_ins_disabled" | "found" | "not_registered" | "error";
  student: {
    name: string;
    nickname: string | null;
    studentId: string | null;
    house: string;
    houseId?: string | null;
    houseColor: string;
    // Medical fields only included when operationally needed (pending/first check-in)
    hasMedicalCondition?: boolean;
    chronicDiseases?: string | null;
    medicalHistory?: string | null;
    drugAllergies?: string | null;
    foodAllergies?: string | null;
    dietaryRestrictions?: string | null;
    faintingHistory?: boolean | null;
    emergencyMedication?: string | null;
    points?: number | null;
  } | null;
  checkedInAt?: Date | null;
  error?: string;
  isWalkIn?: boolean;
}

const MAX_SCORE_AWARD = 500;

class QuotaFullError extends Error {
  constructor() { super("QUOTA_FULL"); }
}

class WalkInQuotaFullError extends Error {
  constructor() { super("WALK_IN_QUOTA_FULL"); }
}

export class ScannerService {
  static async processScan(params: {
    qrToken: string;
    eventId: string;
    // Which session (day) the check-in is recorded against. Resolved/defaulted by
    // the API to the "current" session; always belongs to eventId.
    sessionId: string;
    action: "scan" | "confirm" | "score" | "lookup";
    medsCheckOption?: string | null;
    score?: number;
    reason?: string;
    actorId: string;
    actorRole: string;
    ipAddress: string;
  }): Promise<ScanResult> {
    const { qrToken, eventId, sessionId, action, medsCheckOption, actorId, actorRole, ipAddress } = params;

    const [student, event, session] = await Promise.all([
      UsersService.resolveStudentByToken(qrToken),
      EventsService.getEventById(eventId),
      db.query.eventSessions.findFirst({
        where: and(eq(eventSessions.id, sessionId), eq(eventSessions.eventId, eventId)),
      }),
    ]);

    if (!student) return { status: "not_found", student: null, error: "Student not found in the system." };
    if (!event)   return { status: "not_found", student: null, error: "Event not found" };
    // The session must exist AND belong to this event — blocks a hand-crafted
    // cross-event sessionId from recording attendance against the wrong day.
    if (!session) return { status: "not_found", student: null, error: "Session not found for this event." };

    // Human-readable day label for audit logs (e.g. "Day 1"). Sessions are ordered
    // by sortOrder; the title overrides when set.
    const sessionLabel = session.title?.trim() || "this session";

    const hasMedicalCondition = this.evaluateMedicalCondition(student);

    // Base info: safe to return in all contexts (no sensitive health data)
    const baseStudentInfo = {
      name: student.name,
      nickname: student.nickname,
      studentId: student.studentId,
      house: student.house?.name ?? "UNASSIGNED",
      houseId: student.house?.id,
      houseColor: student.house?.color ?? "#6366f1",
      points: student.points ?? 0,
    };

    // Medical DETAIL (raw free-text health records) is PDPA-restricted to
    // super_admin/admin. Every other scanning role (registration/organizer/smo) gets
    // only the boolean SIGNAL — enough to prompt a medical check at the gate without
    // ever shipping the underlying records in the JSON response (DevTools-readable).
    const canViewMedicalDetail = actorRole === "super_admin" || actorRole === "admin";

    // Signal-only view: what non-admin scanners receive at the gate.
    const studentWithSignal = { ...baseStudentInfo, hasMedicalCondition };

    // Full info: only super_admin/admin sees the detail fields; everyone else falls
    // back to the signal-only view.
    const studentWithMedical = canViewMedicalDetail
      ? {
          ...studentWithSignal,
          chronicDiseases: student.chronicDiseases,
          medicalHistory: student.medicalHistory,
          drugAllergies: student.drugAllergies,
          foodAllergies: student.foodAllergies,
          dietaryRestrictions: student.dietaryRestrictions,
          faintingHistory: student.faintingHistory,
          emergencyMedication: student.emergencyMedication,
        }
      : studentWithSignal;

    /* ── Lookup (score mode) ────────────────────────────────────────────────── */
    // Score mode resolves the student WITHOUT touching attendance (no check-in
    // side effect). Scoring is restricted to students who belong to this event:
    // a student with no attendance record (never registered and never walked in)
    // cannot be given or deducted points here.
    if (action === "lookup") {
      const record = await db.query.attendance.findFirst({
        where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, student.id)),
      });
      if (!record) {
        return {
          status: "not_registered",
          student: baseStudentInfo,
          error: "Student is not registered for this event.",
        };
      }
      // Scoring needs no medical data — return the PDPA-safe base info only.
      return {
        status: "found",
        student: baseStudentInfo,
        checkedInAt: record.status === "attended" ? record.checkInTime : undefined,
      };
    }

    /* ── Score Awarding ─────────────────────────────────────────────────────── */
    if (action === "score") {
      // Defense-in-depth: the scanner-only president roles are check-in only and
      // must never award/deduct individual points, even if a request reaches here.
      if (!canGiveIndividualScore(actorRole)) {
        return {
          status: "error",
          student: baseStudentInfo,
          error: "You do not have permission to give individual scores.",
        };
      }

      const parsedScore = params.score !== undefined ? Number(params.score) : 0;
      // Negative = deduction (penalty/correction); zero is a no-op and rejected.
      if (!Number.isInteger(parsedScore) || parsedScore === 0 || Math.abs(parsedScore) > MAX_SCORE_AWARD) {
        return {
          status: "error",
          student: baseStudentInfo,
          error: `Score must be a non-zero integer between -${MAX_SCORE_AWARD} and ${MAX_SCORE_AWARD}.`,
        };
      }

      // Gate scoring to event participants: a student with no attendance record
      // for this event cannot be scored. Enforced server-side (not just in the UI)
      // so a hand-crafted request can't award/deduct points off-event.
      const enrollment = await db.query.attendance.findFirst({
        where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, student.id)),
      });
      if (!enrollment) {
        return {
          status: "not_registered",
          student: baseStudentInfo,
          error: "Student is not registered for this event.",
        };
      }

      // Wording for logs/audit: "Awarded 5" vs "Deducted 5" reads better than "Awarded -5".
      const verb = parsedScore >= 0 ? "Awarded" : "Deducted";
      const magnitude = Math.abs(parsedScore);

      let newPoints = 0;

      await db.transaction(async (tx) => {
        // Atomic UPDATE: locks the row, increments, and returns the new value in
        // one round-trip. T2 blocks here until T1 commits, then reads the
        // already-incremented value — no separate SELECT FOR UPDATE needed.
        const [result] = await tx
          .update(users)
          // GREATEST floors at 0 so a deduction can never push a student into a negative balance.
          .set({ points: sql`GREATEST(0, COALESCE(${users.points}, 0) + ${parsedScore})` })
          .where(eq(users.id, student.id))
          .returning({ newPoints: users.points });

        newPoints = result?.newPoints ?? parsedScore;
        const previousPoints = newPoints - parsedScore;

        if (student.houseId) {
          const logReason = params.reason?.trim()
            ? `${verb} ${magnitude} pts to ${student.name} - Reason: ${params.reason} (from activity "${event.title}")`
            : `${verb} ${magnitude} individual points to ${student.name} from activity "${event.title}"`;

          await tx.insert(scoreHistory).values({
            houseId: student.houseId,
            eventId: eventId || null,
            delta: 0,
            reason: logReason,
          });
        }

        const oldMilestones = Math.floor(previousPoints / 100);
        const newMilestones = Math.floor(newPoints / 100);
        const milestoneDiff = newMilestones - oldMilestones;

        let housePointsAdded = 0;
        if (milestoneDiff > 0 && student.houseId) {
          housePointsAdded = milestoneDiff * 2;
          await tx.update(houses)
            .set({ points: sql`${houses.points} + ${housePointsAdded}` })
            .where(eq(houses.id, student.houseId));
          await tx.insert(scoreHistory).values({
            houseId: student.houseId,
            eventId: eventId || null,
            delta: housePointsAdded,
            reason: `Student ${student.name} reached 100 point milestone (+${newPoints} total points) from activity "${event.title}"`,
          });
        }

        await AuditService.logActionInternal(tx, {
          actorId,
          targetId: student.id,
          action: `${verb} ${magnitude} individual points to ${student.name} for activity "${event.title}"` +
                  (params.reason?.trim() ? ` (Reason: ${params.reason})` : "") +
                  `. Points updated from ${previousPoints} to ${newPoints}.` +
                  (housePointsAdded > 0 ? ` House ${student.houseId} awarded +${housePointsAdded} points.` : ""),
          ipAddress,
        });
      });

      // Score responses omit medical data — not relevant to point awarding
      return { status: "success", student: { ...baseStudentInfo, points: newPoints } };
    }

    /* ── Check-in: session-registered path ──────────────────────────────────── */
    // The check-in key is the SESSION (day), not the event. A row here means the
    // student is registered for — or already attended — THIS specific session.
    const record = await db.query.attendance.findFirst({
      where: and(eq(attendance.sessionId, sessionId), eq(attendance.studentId, student.id)),
    });

    if (record) {
      if (record.status === "attended") {
        // Already done — return base info only (no reason to re-expose medical data)
        return { status: "already_checked_in", student: baseStudentInfo, checkedInAt: record.checkInTime };
      }

      if (action === "confirm") {
        // Atomic update: WHERE status='registered' ensures only one concurrent
        // confirm wins. The losing request gets 0 rows back → already_checked_in.
        const updated = await db.transaction(async (tx) => {
          const rows = await tx
            .update(attendance)
            .set({
              status: "attended",
              checkInTime: new Date(),
              scannedBy: actorId,
              medsCheckOption: medsCheckOption || null,
            })
            .where(and(eq(attendance.id, record.id), eq(attendance.status, "registered")))
            .returning({ id: attendance.id });

          if (rows.length > 0) {
            await AuditService.logActionInternal(tx, {
              actorId,
              targetId: student.id,
              action: `Confirmed check-in for pre-registered event: ${event.title} (${sessionLabel})`,
              ipAddress,
            });
          }
          return rows;
        });

        if (updated.length === 0) {
          return { status: "already_checked_in", student: baseStudentInfo };
        }
        return { status: "success", student: studentWithMedical };
      }

      // Scan only — staff sees medical alert before deciding to confirm
      return { status: "pending_confirmation", student: studentWithMedical };
    }

    /* ── Check-in: 'once'-mode, first time at THIS session ───────────────────── */
    // In 'once' mode a student registers once for the whole event and may attend
    // any/all sessions. With no row for THIS session yet but an event-level
    // registration, the scan is an attendable check-in — create a fresh attended
    // row for this session (counted as 'pre-registered', not a walk-in).
    if (event.registrationMode === "once") {
      const eventReg = await db.query.attendance.findFirst({
        where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, student.id)),
      });
      if (eventReg) {
        if (action === "confirm") {
          const inserted = await db.transaction(async (tx) => {
            // ON CONFLICT DO NOTHING handles a race where the session row was
            // created between the findFirst above and this insert.
            const rows = await tx
              .insert(attendance)
              .values({
                eventId,
                sessionId,
                studentId: student.id,
                scannedBy: actorId,
                method: "pre-registered",
                status: "attended",
                checkInTime: new Date(),
                medsCheckOption: medsCheckOption || null,
              })
              .onConflictDoNothing()
              .returning({ id: attendance.id });

            if (rows.length > 0) {
              await AuditService.logActionInternal(tx, {
                actorId,
                targetId: student.id,
                action: `Confirmed check-in for pre-registered event: ${event.title} (${sessionLabel})`,
                ipAddress,
              });
            }
            return rows;
          });

          if (inserted.length === 0) {
            return { status: "already_checked_in", student: baseStudentInfo };
          }
          return { status: "success", student: studentWithMedical };
        }
        return { status: "pending_confirmation", student: studentWithMedical };
      }
    }

    /* ── Check-in: walk-in path ─────────────────────────────────────────────── */
    if (!event.walkInsEnabled) {
      return {
        status: "walk_ins_disabled",
        student: baseStudentInfo,
        error: "Walk-ins are not enabled for this event and student is not pre-registered.",
      };
    }

    if (action === "confirm") {
      // Walk-in quota is PER SESSION (walk-ins re-open each day): prefer the
      // session's own sub-cap, falling back to the event-wide one for legacy events.
      const sessionWalkIn = session.quotaWalkIn ?? event.quotaWalkIn ?? null;
      try {
        await db.transaction(async (tx) => {
          if (event.quota !== null || sessionWalkIn !== null) {
            // Lock the SESSION row so concurrent walk-in confirms for the same day
            // serialize here, then recount within the session — quota is per-day,
            // closing the TOCTOU window without blocking other sessions.
            await tx
              .select({ id: eventSessions.id })
              .from(eventSessions)
              .where(eq(eventSessions.id, sessionId))
              .for("update");

            if (event.quota !== null) {
              // Walk-ins are ADDITIVE capacity on top of the per-session seat quota:
              // the day's room cap is quota + sessionWalkIn. The walk-in sub-limit
              // below still caps how many of those extra slots walk-ins take.
              const totalCap = event.quota + (sessionWalkIn ?? 0);
              const [{ n }] = await tx
                .select({ n: sql<number>`count(*)` })
                .from(attendance)
                .where(and(eq(attendance.sessionId, sessionId), eq(attendance.status, "attended")));

              if (Number(n) >= totalCap) throw new QuotaFullError();
            }

            if (sessionWalkIn !== null) {
              const [{ nWalkIn }] = await tx
                .select({ nWalkIn: sql<number>`count(*)` })
                .from(attendance)
                .where(
                  and(
                    eq(attendance.sessionId, sessionId),
                    eq(attendance.status, "attended"),
                    eq(attendance.method, "walk-in")
                  )
                );

              if (Number(nWalkIn) >= sessionWalkIn) throw new WalkInQuotaFullError();
            }
          }

          // ON CONFLICT DO NOTHING handles a race where the student was registered
          // for this session between the findFirst above and this insert.
          const inserted = await tx
            .insert(attendance)
            .values({
              eventId,
              sessionId,
              studentId: student.id,
              scannedBy: actorId,
              method: "walk-in",
              status: "attended",
              checkInTime: new Date(),
              medsCheckOption: medsCheckOption || null,
            })
            .onConflictDoNothing()
            .returning({ id: attendance.id });

          if (inserted.length === 0) throw new Error("ALREADY_CHECKED_IN");

          await AuditService.logActionInternal(tx, {
            actorId,
            targetId: student.id,
            action: `Recorded walk-in check-in for event: ${event.title} (${sessionLabel})`,
            ipAddress,
          });
        });
      } catch (e) {
        if (e instanceof QuotaFullError) {
          return { status: "quota_full", student: null, error: "Event is full. Walk-ins cannot be accepted." };
        }
        if (e instanceof WalkInQuotaFullError) {
          return { status: "quota_full", student: null, error: "Walk-in quota is full. Walk-ins cannot be accepted." };
        }
        if (e instanceof Error && e.message === "ALREADY_CHECKED_IN") {
          return { status: "already_checked_in", student: baseStudentInfo };
        }
        throw e;
      }

      return { status: "success_walk_in", student: studentWithMedical };
    }

    // Walk-in scan only — staff sees medical alert before deciding to confirm
    return { status: "pending_confirmation", isWalkIn: true, student: studentWithMedical };
  }

  static async searchStudents(query: string) {
    // Escape LIKE metacharacters so a query of "%" or "_" can't wildcard-match
    // the whole table; the search should only ever match literal substrings.
    const escaped = query.replace(/[\\%_]/g, "\\$&");
    return await db.query.users.findMany({
      where: (users, { or, like }) =>
        or(
          like(users.studentId, `%${escaped}%`),
          like(users.name, `%${escaped}%`),
          like(users.nickname, `%${escaped}%`)
        ),
      // No qrToken here: it's a long-lived check-in credential, and the manual
      // check-in flow resolves students by plain id instead.
      columns: {
        id: true,
        studentId: true,
        name: true,
        nickname: true,
        houseId: true,
      },
      with: { house: true },
      limit: 10,
    });
  }

  private static evaluateMedicalCondition(student: ResolvedStudent): boolean {
    const checkMedical = (val?: string | null) => {
      if (!val) return false;
      const clean = val.trim().toLowerCase();
      const negativeValues = [
        "", "-", "ไม่มี", "ไม่มีโรคประจำตัว", "ไม่มีประวัติแพ้ยา",
        "ไม่มีประวัติแพ้อาหาร", "ไม่มีโรค", "ไม่มีแพ้ยา",
        "ไม่มีแพ้อาหาร", "ปกติ", "none", "no", "n/a", "nil"
      ];
      return !negativeValues.includes(clean);
    };

    return !!(
      student.faintingHistory ||
      checkMedical(student.chronicDiseases) ||
      checkMedical(student.medicalHistory) ||
      checkMedical(student.drugAllergies) ||
      checkMedical(student.foodAllergies) ||
      checkMedical(student.dietaryRestrictions) ||
      checkMedical(student.emergencyMedication)
    );
  }
}
