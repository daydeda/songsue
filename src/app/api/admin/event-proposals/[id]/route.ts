import { auth } from "@/auth";
import { db } from "@/db";
import { eventProposals } from "@/db/schema";
import { effectiveRoles } from "@/lib/admin-access";
import { REVIEW_PROPOSAL_ROLES } from "@/lib/event-proposals";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const proposalPatchSchema = z.object({
  action: z.enum(["reject", "withdraw"]),
  reviewNote: z.string().trim().max(1000).optional(),
});

// Thrown inside the transaction when the proposal was already resolved by a
// concurrent request between the pre-check and the update (double-click, or
// staff creating the linked event at the same moment — see the proposalId
// linkage in POST /api/admin/events).
class AlreadyResolvedError extends Error {}

// GET /api/admin/event-proposals/[id] — staff-only single-record fetch, used
// by the admin/events "Create Event from Proposal" prefill flow.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    if (!session?.user || !myRoles.some((r) => (REVIEW_PROPOSAL_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const proposal = await db.query.eventProposals.findFirst({
      where: eq(eventProposals.id, id),
      with: {
        club: { columns: { id: true, name: true, isArchived: true } },
        proposer: { columns: { id: true, name: true, studentId: true } },
      },
    });
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    return NextResponse.json(proposal);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/admin/event-proposals/[id] — reject (staff) or withdraw (the
// proposer, own pending proposal only). Approval is NOT a mutation here — it's
// a side effect of staff creating the real event from the proposal (see
// POST /api/admin/events' proposalId linkage), so there is no "approve" action
// on this route. Both actions here re-assert status='pending' inside the same
// UPDATE...WHERE as the resolve step, mirroring
// /api/admin/appeals/[id]'s optimistic-guard pattern exactly.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const data = proposalPatchSchema.parse(await req.json());

    const proposal = await db.query.eventProposals.findFirst({
      where: eq(eventProposals.id, id),
      columns: { id: true, proposedBy: true, status: true, title: true },
    });
    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    const isStaff = myRoles.some((r) => (REVIEW_PROPOSAL_ROLES as readonly string[]).includes(r));
    if (data.action === "reject" && !isStaff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (data.action === "withdraw" && proposal.proposedBy !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (proposal.status !== "pending") {
      return NextResponse.json({ error: "This proposal has already been resolved" }, { status: 409 });
    }

    const newStatus = data.action === "reject" ? "rejected" : "withdrawn";
    const ip = getClientIp(req);

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(eventProposals)
        .set({
          status: newStatus,
          reviewedBy: session.user!.id!,
          reviewedAt: new Date(),
          reviewNote: data.reviewNote ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(eventProposals.id, id), eq(eventProposals.status, "pending")))
        .returning({ id: eventProposals.id });

      if (!updated) {
        throw new AlreadyResolvedError();
      }

      await AuditService.logActionInternal(tx, {
        actorId: session.user!.id!,
        action: `${data.action === "reject" ? "Rejected" : "Withdrew"} event proposal "${proposal.title}" (${id})`,
        ipAddress: ip,
      });
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    if (error instanceof AlreadyResolvedError) {
      return NextResponse.json({ error: "This proposal has already been resolved" }, { status: 409 });
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
