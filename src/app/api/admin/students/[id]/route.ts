import { auth } from "@/auth";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Next.js 15+: params is a Promise and must be awaited
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: targetStudentId } = await params;

    // FE-12: Log the sensitive data access (Immutable Audit Trail)
    await db.insert(auditLogs).values({
      actorId: session.user.id,
      targetId: targetStudentId,
      action: "Viewed Sensitive Medical/Emergency Info",
      ipAddress:
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "unknown",
    });

    const studentData = await db.query.users.findFirst({
      where: eq(users.id, targetStudentId),
      with: { house: true },
    });

    if (!studentData) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(studentData);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
