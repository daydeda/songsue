import { auth } from "@/auth";
import { db } from "@/db";
import { attendance } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/audit.service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const myRoles = session?.user?.roles ?? (session?.user?.role ? [session.user.role] : []);
    const isAdminRole = myRoles.some((r) => ["super_admin", "admin", "registration", "organizer"].includes(r));
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // PDPA-sensitive medical & emergency-contact data is restricted to
    // super_admin/admin (mirrors canExportAttendance on the admin events page).
    // registration/organizer get the roster without health info.
    const canViewMedical = myRoles.includes("super_admin") || myRoles.includes("admin");

    const { id: eventId } = await params;

    const list = await db.query.attendance.findMany({
      where: eq(attendance.eventId, eventId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            nickname: true,
            studentId: true,
            major: true,
            phone: true,
            role: true,
            roles: true,
            // Medical detail is always read here so we can derive the
            // "has a condition" signal, but it is only forwarded to
            // super_admin/admin below (see sanitize step).
            chronicDiseases: true,
            medicalHistory: true,
            drugAllergies: true,
            foodAllergies: true,
            dietaryRestrictions: true,
            faintingHistory: true,
            emergencyMedication: true,
            // Emergency contacts are available to all admin-area roles
            // (super_admin/admin/registration/organizer), unlike medical detail.
            emergencyContacts: true,
          },
          with: {
            house: {
              columns: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
    });

    // Whether a user filled in any meaningful medical field (mirrors
    // hasActualMedicalInfo on the client). "-" and blanks are treated as empty.
    const isMeaningful = (v: unknown) =>
      typeof v === "string" ? v.trim() !== "" && v.trim() !== "-" : !!v;
    const hasMedical = (u: (typeof list)[number]["user"]) =>
      !!u &&
      ([u.chronicDiseases, u.medicalHistory, u.drugAllergies, u.foodAllergies, u.dietaryRestrictions, u.emergencyMedication].some(isMeaningful) ||
        u.faintingHistory === true);

    // super_admin/admin receive the full record (plus the hasMedicalInfo flag).
    // registration/organizer get only the boolean signal that a condition
    // exists — never the detail the student filled in — and no meds-check
    // status (which would itself reveal a condition).
    const sanitized = list.map((row) => {
      const u = row.user;
      const hasMedicalInfo = hasMedical(u);
      if (canViewMedical) {
        return { ...row, user: u ? { ...u, hasMedicalInfo } : u };
      }
      const safeUser = u && {
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        studentId: u.studentId,
        major: u.major,
        phone: u.phone,
        role: u.role,
        roles: u.roles,
        emergencyContacts: u.emergencyContacts,
        house: u.house,
        hasMedicalInfo,
      };
      return { ...row, medsCheckOption: null, user: safeUser };
    });

    // FE-12: Log the sensitive data access (Immutable Audit Trail)
    // Since attendance list now contains medical info, we must log this access if they have permission to view it.
    if (canViewMedical) {
      await AuditService.logAction({
        actorId: session.user.id!,
        action: `Viewed Attendance List for Event ${eventId} (included health info)`,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          req.headers.get("x-real-ip") ||
          "127.0.0.1",
      });
    }

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("Failed to fetch attendance:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
