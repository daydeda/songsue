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
            chronicDiseases: canViewMedical,
            medicalHistory: canViewMedical,
            drugAllergies: canViewMedical,
            foodAllergies: canViewMedical,
            dietaryRestrictions: canViewMedical,
            faintingHistory: canViewMedical,
            // Emergency contacts are available to all admin-area roles
            // (super_admin/admin/registration/organizer), unlike medical info.
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

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch attendance:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
