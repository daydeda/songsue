import { auth } from "@/auth";
import { db } from "@/db";
import { noShowAppeals, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const appealSchema = z.object({
  message: z.string().trim().min(10).max(1000),
});

// GET /api/appeals — the current student's most recent no-show appeal, so the
// dashboard can show "pending review" instead of re-offering the submit form.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appeal = await db.query.noShowAppeals.findFirst({
      where: eq(noShowAppeals.userId, session.user.id),
      orderBy: [desc(noShowAppeals.createdAt)],
      columns: {
        id: true,
        status: true,
        message: true,
        reviewNote: true,
        createdAt: true,
        reviewedAt: true,
      },
    });

    return NextResponse.json({ appeal: appeal ?? null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/appeals — a blocked student submits an appeal against their no-show
// strike-out (US-STRI-15c). Only one pending appeal at a time per student — the
// DB's partial unique index (no_show_appeals_one_pending_per_user) is the real
// guard against a race; the pre-check here just gives a friendlier error.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = appealSchema.parse(await req.json());

    const student = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { noShowCount: true, registrationBlocked: true },
    });
    if (!student?.registrationBlocked) {
      return NextResponse.json(
        { error: "Your registration is not currently blocked, so there's nothing to appeal." },
        { status: 400 }
      );
    }

    const existingPending = await db.query.noShowAppeals.findFirst({
      where: and(eq(noShowAppeals.userId, session.user.id), eq(noShowAppeals.status, "pending")),
      columns: { id: true },
    });
    if (existingPending) {
      return NextResponse.json(
        { error: "You already have an appeal pending review." },
        { status: 409 }
      );
    }

    const [appeal] = await db
      .insert(noShowAppeals)
      .values({
        userId: session.user.id,
        message: data.message,
        noShowCountAtAppeal: student.noShowCount,
      })
      .returning({ id: noShowAppeals.id, status: noShowAppeals.status, createdAt: noShowAppeals.createdAt });

    return NextResponse.json({ appeal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }
    // The partial unique index catches a rare race the pre-check above misses.
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "You already have an appeal pending review." },
        { status: 409 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
