import { auth } from "@/auth";
import { db } from "@/db";
import { NextResponse } from "next/server";

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
        phone: true,
        houseId: true,
        profileCompleted: true,
        role: true,
      },
      with: { house: true },
    });

    return NextResponse.json(allStudents);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
