import { db } from "@/db";
import { attendance, users, houses, scoreHistory, events } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { UsersService } from "../users/users.service";
import { EventsService } from "./events.service";
import { AuditService } from "../audit/audit.service";

type ResolvedStudent = NonNullable<Awaited<ReturnType<typeof UsersService.resolveStudentByToken>>>;

export interface ScanResult {
  status: "success" | "success_walk_in" | "pending_confirmation" | "already_checked_in" | "not_found" | "quota_full" | "walk_ins_disabled" | "error";
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
    action: "scan" | "confirm" | "score";
    medsCheckOption?: string | null;
    score?: number;
    reason?: string;
    actorId: string;
    ipAddress: string;
  }): Promise<ScanResult> {
    const { qrToken, eventId, action, medsCheckOption, actorId, ipAddress } = params;

    const [student, event] = await Promise.all([
      UsersService.resolveStudentByToken(qrToken),
      EventsService.getEventById(eventId),
    ]);

    if (!student) return { status: "not_found", student: null, error: "Student not found in the system." };
    if (!event)   return { status: "not_found", student: null, error: "Event not found" };

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

    // Full info: only returned when staff needs to act on a student at the gate
    const studentWithMedical = {
      ...baseStudentInfo,
      hasMedicalCondition,
      chronicDiseases: student.chronicDiseases,
      medicalHistory: student.medicalHistory,
      drugAllergies: student.drugAllergies,
      foodAllergies: student.foodAllergies,
      dietaryRestrictions: student.dietaryRestrictions,
      faintingHistory: student.faintingHistory,
      emergencyMedication: student.emergencyMedication,
    };

    /* ── Score Awarding ─────────────────────────────────────────────────────── */
    if (action === "score") {
      const parsedScore = params.score !== undefined ? Number(params.score) : 0;
      if (!Number.isInteger(parsedScore) || parsedScore < 1 || parsedScore > MAX_SCORE_AWARD) {
        return {
          status: "error",
          student: baseStudentInfo,
          error: `Score must be an integer between 1 and ${MAX_SCORE_AWARD}.`,
        };
      }

      let newPoints = 0;

      await db.transaction(async (tx) => {
        // Atomic UPDATE: locks the row, increments, and returns the new value in
        // one round-trip. T2 blocks here until T1 commits, then reads the
        // already-incremented value — no separate SELECT FOR UPDATE needed.
        const [result] = await tx
          .update(users)
          .set({ points: sql`COALESCE(${users.points}, 0) + ${parsedScore}` })
          .where(eq(users.id, student.id))
          .returning({ newPoints: users.points });

        newPoints = result?.newPoints ?? parsedScore;
        const previousPoints = newPoints - parsedScore;

        if (student.houseId) {
          const logReason = params.reason?.trim()
            ? `Awarded ${parsedScore} pts to ${student.name} - Reason: ${params.reason} (from activity "${event.title}")`
            : `Awarded ${parsedScore} individual points to ${student.name} from activity "${event.title}"`;

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
          action: `Awarded ${parsedScore} individual points to ${student.name} for activity "${event.title}"` +
                  (params.reason?.trim() ? ` (Reason: ${params.reason})` : "") +
                  `. Points updated from ${previousPoints} to ${newPoints}.` +
                  (housePointsAdded > 0 ? ` House ${student.houseId} awarded +${housePointsAdded} points.` : ""),
          ipAddress,
        });
      });

      // Score responses omit medical data — not relevant to point awarding
      return { status: "success", student: { ...baseStudentInfo, points: newPoints } };
    }

    /* ── Check-in: pre-registered path ─────────────────────────────────────── */
    const record = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, student.id)),
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
              action: `Confirmed check-in for pre-registered event: ${event.title}`,
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

    /* ── Check-in: walk-in path ─────────────────────────────────────────────── */
    if (!event.walkInsEnabled) {
      return {
        status: "walk_ins_disabled",
        student: baseStudentInfo,
        error: "Walk-ins are not enabled for this event and student is not pre-registered.",
      };
    }

    if (action === "confirm") {
      try {
        await db.transaction(async (tx) => {
          if (event.quota !== null || event.quotaWalkIn !== null) {
            // Lock the event row so concurrent confirms serialize here, then
            // recount — preventing the quota bypass TOCTOU window.
            const [lockedEvent] = await tx
              .select({
                quota: events.quota,
                quotaWalkIn: events.quotaWalkIn,
              })
              .from(events)
              .where(eq(events.id, eventId))
              .for("update");

            if (lockedEvent?.quota !== null) {
              // Walk-ins are ADDITIVE capacity on top of the pre-registration quota:
              // the total room cap is quota + quotaWalkIn (e.g. 400 registered + 20
              // walk-in = 420 in the room). This lets walk-ins fill estimated extra
              // space even when all pre-registered seats are taken. The walk-in
              // sub-limit below still caps how many of those extra slots walk-ins take.
              // (quotaWalkIn null = no explicit extra capacity → cap stays at quota.)
              const totalCap = (lockedEvent?.quota ?? 0) + (lockedEvent?.quotaWalkIn ?? 0);
              const [{ n }] = await tx
                .select({ n: sql<number>`count(*)` })
                .from(attendance)
                .where(and(eq(attendance.eventId, eventId), eq(attendance.status, "attended")));

              if (Number(n) >= totalCap) throw new QuotaFullError();
            }

            if (lockedEvent?.quotaWalkIn !== null) {
              const [{ nWalkIn }] = await tx
                .select({ nWalkIn: sql<number>`count(*)` })
                .from(attendance)
                .where(
                  and(
                    eq(attendance.eventId, eventId),
                    eq(attendance.status, "attended"),
                    eq(attendance.method, "walk-in")
                  )
                );

              if (Number(nWalkIn) >= (lockedEvent?.quotaWalkIn ?? 0)) throw new WalkInQuotaFullError();
            }
          }

          // ON CONFLICT DO NOTHING handles a race where the student was registered
          // between the findFirst above and this insert.
          const inserted = await tx
            .insert(attendance)
            .values({
              eventId,
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
            action: `Recorded walk-in check-in for event: ${event.title}`,
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
