import { auth } from "@/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

// Fail fast instead of hanging to the 300s platform default if the DB pooler stalls.
export const maxDuration = 20;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !["super_admin", "admin", "registration"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only fetch non-sensitive data for the general directory
    const allStudents = await db.query.users.findMany({
      columns: {
        id: true,
        studentId: true,
        name: true,
        prefix: true,
        nickname: true,
        major: true,
        // No phone here: nothing in the directory UI renders it, and PDPA says
        // bulk endpoints carry the minimum. The super_admin-only detail route
        // (/api/admin/students/[id]) still returns contact info when needed.
        houseId: true,
        profileCompleted: true,
        role: true,
        roles: true,
      },
      with: { house: true },
    });

    return NextResponse.json(allStudents);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
