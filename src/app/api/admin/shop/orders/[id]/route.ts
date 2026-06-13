import { auth } from "@/auth";
import { db } from "@/db";
import { shopOrders } from "@/db/schema";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { isShopAdmin } from "@/lib/shop-auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  // "revert" sends an already-reviewed order back to pending so it can be re-checked.
  action: z.enum(["approve", "reject", "revert"]),
  rejectionReason: z.string().max(500).optional(),
});

const STATUS_BY_ACTION = { approve: "approved", reject: "rejected", revert: "pending" } as const;
const LABEL_BY_ACTION = { approve: "Approved", reject: "Rejected", revert: "Reverted to pending" } as const;

// PATCH /api/admin/shop/orders/[id] — approve or reject an order after viewing the
// slip. Rejecting frees the reserved stock automatically (the sold/owned queries
// ignore rejected orders), so a rejected order's units become buyable again.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isShopAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const data = reviewSchema.parse(await req.json());

    const [order] = await db.select({ id: shopOrders.id, status: shopOrders.status }).from(shopOrders).where(eq(shopOrders.id, id)).limit(1);
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const newStatus = STATUS_BY_ACTION[data.action];
    const isRevert = data.action === "revert";

    await db.transaction(async (tx) => {
      await tx
        .update(shopOrders)
        .set({
          status: newStatus,
          // Reverting clears the review trail so the order looks freshly pending.
          reviewedBy: isRevert ? null : session!.user!.id!,
          reviewedAt: isRevert ? null : new Date(),
          rejectionReason: data.action === "reject" ? data.rejectionReason ?? null : null,
          updatedAt: new Date(),
        })
        .where(eq(shopOrders.id, id));

      await AuditService.logActionInternal(tx, {
        actorId: session!.user!.id!,
        targetId: id,
        action: `${LABEL_BY_ACTION[data.action]} shop order ${id}`,
        ipAddress: getClientIp(req),
      });
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
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
