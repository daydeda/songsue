import { auth } from "@/auth";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { NextResponse, type NextRequest } from "next/server";

const PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["super_admin", "admin"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get("pageSize")) || PAGE_SIZE));

    const [logs, total] = await Promise.all([
      db.query.auditLogs.findMany({
        with: {
          actor: { columns: { id: true, name: true, role: true } },
          target: { columns: { id: true, studentId: true, name: true } },
        },
        orderBy: (auditLogs, { desc }) => [desc(auditLogs.timestamp)],
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      db.$count(auditLogs),
    ]);

    return NextResponse.json({ logs, total, page, pageSize });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

