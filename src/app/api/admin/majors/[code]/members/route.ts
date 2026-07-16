import { auth } from "@/auth";
import { effectiveRoles } from "@/lib/admin-access";
import { EventScopeService } from "@/modules/events/event-scope.service";
import { MajorsService } from "@/modules/majors/majors.service";
import { NextResponse } from "next/server";

// GET /api/admin/majors/[code]/members — List the students belonging to a
// major (name, studentId), for the major_president's Event Staff picker on
// /admin/majors (mirrors GET /api/admin/clubs/[id]/members). Gate:
// super_admin/admin, OR a major_president viewing THEIR OWN major (verified
// server-side via EventScopeService.getPresidentScope, i.e. the president's
// own users.major — never trust the client-supplied :code alone). This
// carries identity PII (name + studentId) for every student in the major, so
// it must not be visible to another major's president or any role beyond the
// two that already manage student identities plus the major's own president.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const isAdminRole = ["super_admin", "admin"].includes(session.user.role || "");

    if (!isAdminRole) {
      const myRoles = effectiveRoles(session.user.role, session.user.roles);
      const scope = await EventScopeService.getPresidentScope(session.user.id!, myRoles);
      if (!scope.majors.includes(code)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const members = await MajorsService.getMajorMembers(code);
    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to fetch major members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
