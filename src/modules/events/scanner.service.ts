import { db } from "@/db";
import { attendance, users, houses, scoreHistory } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { UsersService } from "../users/users.service";
import { EventsService } from "./events.service";
import { AuditService } from "../audit/audit.service";
import { realtimeEmitter } from "@/lib/realtime-emitter";

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
    hasMedicalCondition: boolean;
    chronicDiseases: string | null;
    medicalHistory: string | null;
    drugAllergies: string | null;
    foodAllergies: string | null;
    dietaryRestrictions: string | null;
    faintingHistory: boolean | null;
    emergencyMedication: string | null;
    points?: number | null;
  } | null;
  checkedInAt?: Date | null;
  error?: string;
  isWalkIn?: boolean;
}

export class ScannerService {
  /**
   * Processes a QR code scan or manual confirmation for a student and event.
   * Ensures atomic database transactions and strict data security limits (PDPA).
   */
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
    const { qrToken, eventId, action, medsCheckOption, score, reason, actorId, ipAddress } = params;

    // 1. Resolve student via UsersService
    const student = await UsersService.resolveStudentByToken(qrToken);
    if (!student) {
      return {
        status: "not_found",
        student: null,
        error: "Student not found in the system.",
      };
    }

    // 2. Resolve event via EventsService
    const event = await EventsService.getEventById(eventId);
    if (!event) {
      return {
        status: "not_found",
        student: null,
        error: "Event not found",
      };
    }

    // 4. PDPA Helper: Identify if any medical warnings exist
    const hasMedicalCondition = this.evaluateMedicalCondition(student);

    const studentInfo = {
      name: student.name,
      nickname: student.nickname,
      studentId: student.studentId,
      house: student.house?.name ?? "UNASSIGNED",
      houseId: student.house?.id,
      houseColor: student.house?.color ?? "#6366f1",
      hasMedicalCondition,
      chronicDiseases: student.chronicDiseases,
      medicalHistory: student.medicalHistory,
      drugAllergies: student.drugAllergies,
      foodAllergies: student.foodAllergies,
      dietaryRestrictions: student.dietaryRestrictions,
      faintingHistory: student.faintingHistory,
      emergencyMedication: student.emergencyMedication,
      points: student.points ?? 0,
    };

    // Case C: Score Awarding Flow
    if (action === "score") {
      const parsedScore = score !== undefined ? Number(score) : 0;
      if (isNaN(parsedScore) || parsedScore <= 0) {
        return {
          status: "error",
          student: studentInfo,
          error: "Invalid score value.",
        };
      }

      const previousPoints = student.points ?? 0;
      const newPoints = previousPoints + parsedScore;

      await db.transaction(async (tx) => {
        // A. Update student points
        await tx
          .update(users)
          .set({ points: newPoints })
          .where(eq(users.id, student.id));

        // B. Log individual score history
        if (student.houseId) {
          const individualLogReason = reason && reason.trim() !== ""
            ? `Awarded ${parsedScore} pts to ${student.name} - Reason: ${reason} (from activity "${event.title}")`
            : `Awarded ${parsedScore} individual points to ${student.name} from activity "${event.title}"`;

          await tx.insert(scoreHistory).values({
            houseId: student.houseId,
            eventId: eventId || null,
            delta: 0,
            reason: individualLogReason,
          });
        }

        // C. Check milestone crossing (every 100 points)
        const oldMilestones = Math.floor(previousPoints / 100);
        const newMilestones = Math.floor(newPoints / 100);
        const milestoneDiff = newMilestones - oldMilestones;

        let houseAwarded = false;
        let housePointsAdded = 0;

        if (milestoneDiff > 0 && student.houseId) {
          housePointsAdded = milestoneDiff * 2;
          // Update house points
          await tx
            .update(houses)
            .set({ points: sql`${houses.points} + ${housePointsAdded}` })
            .where(eq(houses.id, student.houseId));

          // Log score history for the house milestone
          await tx.insert(scoreHistory).values({
            houseId: student.houseId,
            eventId: eventId || null,
            delta: housePointsAdded,
            reason: `Student ${student.name} reached 100 point milestone (+${newPoints} total points) from activity "${event.title}"`,
          });
          houseAwarded = true;
        }

        // C. Log transaction audit trail
        await AuditService.logActionInternal(tx, {
          actorId,
          targetId: student.id,
          action: `Awarded ${parsedScore} individual points to ${student.name} for activity "${event.title}"` +
                  (reason && reason.trim() !== "" ? ` (Reason: ${reason})` : "") +
                  `. Points updated from ${previousPoints} to ${newPoints}.` + 
                  (houseAwarded ? ` House ${student.houseId} awarded +${housePointsAdded} points.` : ""),
          ipAddress,
        });
      });

      // Broadcast real-time update if house points were modified
      const houseObj = student.houseId
        ? await db.query.houses.findFirst({ where: eq(houses.id, student.houseId) })
        : null;

      const oldMilestones = Math.floor(previousPoints / 100);
      const newMilestones = Math.floor(newPoints / 100);
      const milestoneDiff = newMilestones - oldMilestones;

      if (houseObj && milestoneDiff > 0) {
        realtimeEmitter.emit("dashboard_update", {
          type: "score",
          houseId: student.houseId,
          houseName: houseObj.name,
          houseColor: houseObj.color ?? "#6366f1",
          delta: milestoneDiff * 2,
          reason: `Student ${student.name} reached 100 point milestone (+${newPoints} total points) from activity "${event.title}"`,
          timestamp: new Date().toISOString(),
        });
      }

      realtimeEmitter.emit("dashboard_update", {
        type: "score_awarded",
        studentName: student.name,
        studentNickname: student.nickname,
        pointsAwarded: parsedScore,
        timestamp: new Date().toISOString(),
      });

      return {
        status: "success",
        student: {
          ...studentInfo,
          points: newPoints,
        },
      };
    }

    // 3. Resolve existing attendance record
    const record = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, student.id)),
    });

    // Case A: Student is already registered
    if (record) {
      if (record.status === "attended") {
        return {
          status: "already_checked_in",
          student: studentInfo,
          checkedInAt: record.checkInTime,
        };
      }

      // Pre-registered but not checked in yet
      if (action === "confirm") {
        await db.transaction(async (tx) => {
          // Update attendance status
          await tx
            .update(attendance)
            .set({
              status: "attended",
              checkInTime: new Date(),
              scannedBy: actorId,
              medsCheckOption: medsCheckOption || null,
            })
            .where(eq(attendance.id, record.id));

          // Log transaction audit trail
          await AuditService.logActionInternal(tx, {
            actorId,
            targetId: student.id,
            action: `Confirmed check-in for pre-registered event: ${event.title}`,
            ipAddress,
          });
        });

        // Broadcast real-time update
        realtimeEmitter.emit("dashboard_update", {
          type: "checkin",
          studentName: student.name,
          studentNickname: student.nickname,
          eventTitle: event.title,
          timestamp: new Date().toISOString(),
        });

        return {
          status: "success",
          student: studentInfo,
        };
      }

      // Needs confirmation
      return {
        status: "pending_confirmation",
        student: studentInfo,
      };
    }

    // Case B: Not registered (Walk-in Flow)
    if (event.walkInsEnabled) {
      // Quota checking
      if (event.quota !== null) {
        const currentCount = await EventsService.getAttendeeCount(eventId);
        if (currentCount >= event.quota) {
          return {
            status: "quota_full",
            student: null,
            error: "Event is full. Walk-ins cannot be accepted.",
          };
        }
      }

      // Confirm walk-in check-in
      if (action === "confirm") {
        await db.transaction(async (tx) => {
          await tx.insert(attendance).values({
            eventId: eventId,
            studentId: student.id,
            scannedBy: actorId,
            method: "walk-in",
            status: "attended",
            checkInTime: new Date(),
            medsCheckOption: medsCheckOption || null,
          });

          await AuditService.logActionInternal(tx, {
            actorId,
            targetId: student.id,
            action: `Recorded walk-in check-in for event: ${event.title}`,
            ipAddress,
          });
        });

        // Broadcast real-time update
        realtimeEmitter.emit("dashboard_update", {
          type: "checkin",
          studentName: student.name,
          studentNickname: student.nickname,
          eventTitle: event.title,
          timestamp: new Date().toISOString(),
        });

        return {
          status: "success_walk_in",
          student: studentInfo,
        };
      }

      return {
        status: "pending_confirmation",
        isWalkIn: true,
        student: studentInfo,
      };
    }

    // Walk-ins disabled
    return {
      status: "walk_ins_disabled",
      student: studentInfo,
      error: "Walk-ins are not enabled for this event and student is not pre-registered.",
    };
  }

  /**
   * Search students for manual fallback check-in
   */
  static async searchStudents(query: string) {
    return await db.query.users.findMany({
      where: (users, { or, like }) =>
        or(
          like(users.studentId, `%${query}%`),
          like(users.name, `%${query}%`),
          like(users.nickname, `%${query}%`)
        ),
      columns: {
        id: true,
        studentId: true,
        name: true,
        nickname: true,
        houseId: true,
        qrToken: true,
      },
      with: { house: true },
      limit: 10,
    });
  }

  /**
   * Evaluates if raw text is a valid medical condition (PDPA evaluation)
   */
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
