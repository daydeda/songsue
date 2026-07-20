import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { effectiveRoles } from "@/lib/admin-access";
import { resolveFacultyViewScope, matchesFacultyScope } from "@/lib/faculty-scope";

// Next.js 15+: params is a Promise and must be awaited
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const myRoles = session?.user
      ? effectiveRoles(session.user.role, session.user.roles)
      : [];
    // Medical/emergency detail: admin/super_admin only (see CLAUDE.md's PDPA
    // rule) — registration/organizer only ever get the signal, never this.
    if (!session?.user || !myRoles.some((r) => ["super_admin", "admin"].includes(r))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: targetStudentId } = await params;

    const studentData = await db.query.users.findFirst({
      where: eq(users.id, targetStudentId),
      // qrToken is a permanent check-in credential replayable at /api/admin/scan,
      // so it must never leave the server — every other route strips it too.
      columns: { qrToken: false },
      with: { house: true },
    });

    if (!studentData) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Faculty scoping (see src/lib/faculty-scope.ts): a non-super_admin actor
    // (i.e. admin) may only view medical detail for a student in their own
    // faculty — super_admin is always global.
    if (!myRoles.includes("super_admin")) {
      const scope = resolveFacultyViewScope(myRoles, session.user.faculty);
      if (!matchesFacultyScope(studentData.faculty, scope, studentData.role, studentData.roles)) {
        return NextResponse.json({ error: "Forbidden: Student is outside your faculty" }, { status: 403 });
      }
    }

    // FE-12: Log the sensitive data access (Immutable Audit Trail)
    await AuditService.logAction({
      actorId: session.user.id!,
      targetId: targetStudentId,
      action: "Viewed Sensitive Medical/Emergency Info",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(studentData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
