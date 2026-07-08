import { auth } from "@/auth";
import { db } from "@/db";
import { noShowAppeals } from "@/db/schema";
import { effectiveRoles } from "@/lib/admin-access";
import { RESET_STRIKES_ROLES } from "@/lib/strikes";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/admin/appeals — list no-show appeals for staff review, most recent
// first. Gated the same as RESET_STRIKES_ROLES: resolving an appeal reverses a
// student's strike, so viewing the queue is scoped just as narrowly. Each
// appeal is tied to one specific event (US-STRI-15c: per-event appeals, not a
// blanket account appeal) via the direct eventId relation — no more
// best-effort matching against a user's recent no-show attendance rows.
export async function GET(req: Request) {
  try {
    const session = await auth();
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    if (!session?.user || !myRoles.some((r) => (RESET_STRIKES_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const appeals = await db.query.noShowAppeals.findMany({
      where: status ? eq(noShowAppeals.status, status) : undefined,
      orderBy: [desc(noShowAppeals.createdAt)],
      with: {
        user: {
          columns: { id: true, name: true, studentId: true, noShowCount: true, registrationBlocked: true },
          with: { house: { columns: { id: true, name: true, color: true } } },
        },
        event: { columns: { id: true, title: true, endTime: true } },
        reviewer: {
          columns: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ appeals });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
