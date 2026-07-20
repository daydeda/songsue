import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { NextResponse } from "next/server";
import { effectiveRoles } from "@/lib/admin-access";
import { resolveFacultyViewScope, facultyRowCondition } from "@/lib/faculty-scope";

// Fail fast instead of hanging to the 300s platform default if the DB pooler stalls.
export const maxDuration = 20;

export async function GET() {
  try {
    const session = await auth();
    const myRoles = session?.user
      ? effectiveRoles(session.user.role, session.user.roles)
      : [];
    if (
      !session?.user ||
      !myRoles.some((r) => ["super_admin", "admin", "registration"].includes(r))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Contact info (email/phone/contactChannels) is only ever included for
    // super_admin and admin (full parity outside deletion/settings/faculty-
    // reassignment) — registration/organizer etc. on this bulk directory
    // endpoint still get the PDPA-minimal columns, same as before.
    const canSeeContactInfo = myRoles.some((r) => ["super_admin", "admin"].includes(r));

    // Faculty scoping (see src/lib/faculty-scope.ts): a non-super_admin actor
    // only sees students in their own faculty. An actor with no faculty
    // assigned yet sees nobody, rather than defaulting to CAMT.
    const facultyScope = resolveFacultyViewScope(myRoles, session.user.faculty);
    if (!facultyScope.global && facultyScope.faculty === null) {
      return NextResponse.json(
        { error: "No faculty assigned to your account yet. Ask a super admin to assign one." },
        { status: 403 },
      );
    }

    // Only fetch non-sensitive data for the general directory
    const allStudents = await db.query.users.findMany({
      // users.role passed so a null-faculty STAFF row (unassigned yet) is
      // never swept into the CAMT default — only a plain student is.
      where: facultyScope.global ? undefined : facultyRowCondition(users.faculty, facultyScope.faculty, users.role),
      columns: {
        id: true,
        studentId: true,
        name: true,
        prefix: true,
        nickname: true,
        major: true,
        smoPosition: true,
        anusmoPosition: true,
        houseId: true,
        profileCompleted: true,
        role: true,
        roles: true,
        // Not PDPA-sensitive — visible to every role that reaches this
        // directory. Needed client-side so super_admin can assign a staff
        // account's faculty scope (see src/lib/faculty-scope.ts).
        faculty: true,
        noShowCount: true,
        registrationBlocked: true,
        previewAccess: true,
        ...(canSeeContactInfo ? { email: true, phone: true, contactChannels: true } : {}),
      },
      with: { house: true },
    });

    return NextResponse.json(allStudents);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
