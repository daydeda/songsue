import { db } from "@/db";
import { attendance } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { UsersService } from "../users/users.service";
import { EventsService } from "./events.service";
import { AuditService } from "../audit/audit.service";
import { realtimeEmitter } from "@/lib/realtime-emitter";

export interface ScanResult {
  status: "success" | "success_walk_in" | "pending_confirmation" | "already_checked_in" | "not_found" | "quota_full" | "walk_ins_disabled";
  student: {
    name: string;
    nickname: string | null;
    studentId: string | null;
    house: string;
    houseColor: string;
    hasMedicalCondition: boolean;
    chronicDiseases: string | null;
    medicalHistory: string | null;
    drugAllergies: string | null;
    foodAllergies: string | null;
    dietaryRestrictions: string | null;
    faintingHistory: boolean | null;
    emergencyMedication: string | null;
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
    action: "scan" | "confirm";
    medsCheckOption?: string | null;
    actorId: string;
    ipAddress: string;
  }): Promise<ScanResult> {
    const { qrToken, eventId, action, medsCheckOption, actorId, ipAddress } = params;

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

    // 3. Resolve existing attendance record
    const record = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, student.id)),
    });

    // 4. PDPA Helper: Identify if any medical warnings exist
    const hasMedicalCondition = this.evaluateMedicalCondition(student);

    const studentInfo = {
      name: student.name,
      nickname: student.nickname,
      studentId: student.studentId,
      house: student.house?.name ?? "UNASSIGNED",
      houseColor: (student.house as any)?.color ?? "#6366f1",
      hasMedicalCondition,
      chronicDiseases: student.chronicDiseases,
      medicalHistory: student.medicalHistory,
      drugAllergies: student.drugAllergies,
      foodAllergies: student.foodAllergies,
      dietaryRestrictions: student.dietaryRestrictions,
      faintingHistory: student.faintingHistory,
      emergencyMedication: student.emergencyMedication,
    };

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
  private static evaluateMedicalCondition(student: any): boolean {
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
