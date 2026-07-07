import { auth } from "@/auth";
import { db } from "@/db";
import { noShowAppeals, users } from "@/db/schema";
import { effectiveRoles } from "@/lib/admin-access";
import { RESET_STRIKES_ROLES } from "@/lib/strikes";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const resolveSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

// Thrown inside the transaction when the appeal was resolved by a concurrent
// request between the pre-check and the update (double-click, two admins).
class AlreadyResolvedError extends Error {}

// PATCH /api/admin/appeals/[id] — approve or reject a student's no-show appeal.
// Approving both resolves the appeal AND resets the student's strikes (mirrors
// src/app/api/admin/students/[id]/strikes/reset/route.ts) in one transaction, so
// an appeal can never be left "approved" while the student stays blocked.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    if (!session?.user || !myRoles.some((r) => (RESET_STRIKES_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = resolveSchema.parse(await req.json());

    const appeal = await db.query.noShowAppeals.findFirst({
      where: eq(noShowAppeals.id, id),
      columns: { id: true, userId: true, status: true, noShowCountAtAppeal: true },
    });
    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }
    if (appeal.status !== "pending") {
      return NextResponse.json({ error: "This appeal has already been resolved" }, { status: 409 });
    }

    const newStatus = data.action === "approve" ? "approved" : "rejected";

    await db.transaction(async (tx) => {
      // Re-assert 'pending' inside the transaction (not just the pre-check above) so
      // a concurrent PATCH on the same appeal — double-click, or two admins — can't
      // silently overwrite an already-resolved outcome (e.g. a reject clobbering an
      // approve that already reset the student's strikes).
      const [updated] = await tx
        .update(noShowAppeals)
        .set({
          status: newStatus,
          reviewedBy: session!.user!.id!,
          reviewedAt: new Date(),
          reviewNote: data.note ?? null,
        })
        .where(and(eq(noShowAppeals.id, id), eq(noShowAppeals.status, "pending")))
        .returning({ id: noShowAppeals.id });

      if (!updated) {
        throw new AlreadyResolvedError();
      }

      let action = `${data.action === "approve" ? "Approved" : "Rejected"} no-show appeal ${id}`;

      if (data.action === "approve") {
        await tx
          .update(users)
          .set({ noShowCount: 0, registrationBlocked: false })
          .where(eq(users.id, appeal.userId));
        action += `, reset strikes (was ${appeal.noShowCountAtAppeal}/3)`;
      }

      await AuditService.logActionInternal(tx, {
        actorId: session!.user!.id!,
        targetId: appeal.userId,
        action,
        ipAddress: getClientIp(req),
      });
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    if (error instanceof AlreadyResolvedError) {
      return NextResponse.json({ error: "This appeal has already been resolved" }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
