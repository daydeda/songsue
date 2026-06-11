import { auth } from "@/auth";
import { db } from "@/db";
import { forms, houses, scoreHistory } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/audit.service";

const ADMIN_ROLES = ["super_admin", "admin", "registration", "organizer"];

// POST /api/admin/events/[id]/form/award — close a form and award points to house with most completions
// Body: { formId: string }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !ADMIN_ROLES.includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const { formId } = await req.json();

    if (!formId) {
      return NextResponse.json({ error: "formId is required" }, { status: 400 });
    }

    // 1. Get the specific form (must belong to this event)
    const formObj = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.eventId, eventId)),
      with: {
        submissions: {
          with: {
            user: { columns: { houseId: true } },
          },
        },
      },
    });

    if (!formObj) {
      return NextResponse.json({ error: "Form not found for this event" }, { status: 404 });
    }

    if (formObj.isAwarded) {
      return NextResponse.json({ error: "Points have already been awarded for this form." }, { status: 400 });
    }

    const submissions = formObj.submissions;
    if (submissions.length === 0) {
      await db.update(forms).set({ isActive: false, updatedAt: new Date() }).where(eq(forms.id, formObj.id));
      return NextResponse.json({ success: true, message: "Form closed, but no points awarded since there were no submissions." });
    }

    // 2. Count submissions per house
    const houseCounts: Record<string, number> = {};
    for (const sub of submissions) {
      const houseId = sub.user?.houseId;
      if (!houseId) continue;
      houseCounts[houseId] = (houseCounts[houseId] || 0) + 1;
    }

    const houseList = Object.entries(houseCounts);
    if (houseList.length === 0) {
      await db.update(forms).set({ isActive: false, updatedAt: new Date() }).where(eq(forms.id, formObj.id));
      return NextResponse.json({ success: true, message: "Form closed, but no houses had submitted. No points awarded." });
    }

    // 3. Find max and winners (handles ties)
    let maxSubmissions = -1;
    for (const [, count] of houseList) {
      if (count > maxSubmissions) maxSubmissions = count;
    }
    const winningHouseIds = houseList.filter(([, count]) => count === maxSubmissions).map(([hId]) => hId);

    const dbHouses = await db.query.houses.findMany();
    const houseNameMap = new Map(dbHouses.map((h) => [h.id, h.name]));
    const pointsToAward = formObj.pointsAwarded ?? 0;

    // 4. Award points in a transaction
    let alreadyAwarded = false;
    await db.transaction(async (tx) => {
      // Close form and mark as awarded. The WHERE is_awarded = false makes this the
      // atomic gate: two concurrent award calls both pass the check above, but only
      // the first flips the flag and gets a row back — the loser updates 0 rows and
      // bails before granting points, so points can never be awarded twice.
      const flipped = await tx
        .update(forms)
        .set({ isActive: false, isAwarded: true, updatedAt: new Date() })
        .where(and(eq(forms.id, formObj.id), eq(forms.isAwarded, false)))
        .returning({ id: forms.id });

      if (flipped.length === 0) {
        alreadyAwarded = true;
        return;
      }

      for (const winnerId of winningHouseIds) {
        const houseName = houseNameMap.get(winnerId) || winnerId;

        if (pointsToAward > 0) {
          await tx
            .update(houses)
            .set({ points: sql`${houses.points} + ${pointsToAward}` })
            .where(eq(houses.id, winnerId));
        }

        const reasonStr =
          winningHouseIds.length > 1
            ? `Event Form Contest Tie Winner: ${houseName} House completed the evaluation form "${formObj.title}" most with ${maxSubmissions} submissions! Shared ${pointsToAward} PTS.`
            : `Event Form Contest Winner: ${houseName} House completed the evaluation form "${formObj.title}" most with ${maxSubmissions} submissions! Received ${pointsToAward} PTS.`;

        await tx.insert(scoreHistory).values({
          houseId: winnerId,
          eventId,
          delta: pointsToAward,
          reason: reasonStr,
          timestamp: new Date(),
        });

        // Audit Log (through the service so the hash chain stays intact)
        await AuditService.logActionInternal(tx, {
          actorId: session.user!.id!,
          action: `Awarded ${pointsToAward} PTS to house ${winnerId} for evaluation form "${formObj.title}" (${formObj.formType}) completion winner for event ${eventId}.`,
          ipAddress:
            req.headers.get("x-forwarded-for")?.split(",")[0] ||
            req.headers.get("x-real-ip") ||
            "127.0.0.1",
        });
      }
    });

    if (alreadyAwarded) {
      return NextResponse.json({ error: "Points have already been awarded for this event's evaluation form contest." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      winners: winningHouseIds.map((wId) => houseNameMap.get(wId) || wId),
      submissionsCount: maxSubmissions,
    });
  } catch (error) {
    console.error("Failed to award event form points:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
