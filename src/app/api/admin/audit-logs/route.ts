import { auth } from "@/auth";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logs = await db.query.auditLogs.findMany({
      with: {
        actor: { columns: { id: true, name: true, role: true } },
        target: { columns: { id: true, studentId: true, name: true } },
      },
      orderBy: (auditLogs, { desc }) => [desc(auditLogs.timestamp)],
      limit: 200,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.delete(auditLogs);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
