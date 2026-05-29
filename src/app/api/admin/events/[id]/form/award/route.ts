import { auth } from "@/auth";
import { db } from "@/db";
import { forms, houses, scoreHistory, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// POST /api/admin/events/[id]/form/award — Close form and award points to house with most completions
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;

    // 1. Get the form details and submissions
    const formObj = await db.query.forms.findFirst({
      where: eq(forms.eventId, eventId),
      with: {
        submissions: {
          with: {
            user: {
              columns: {
                houseId: true,
              },
            },
          },
        },
      },
    });

    if (!formObj) {
      return NextResponse.json({ error: "Form not found for this event" }, { status: 404 });
    }

    if (formObj.isAwarded) {
      return NextResponse.json({ error: "Points have already been awarded for this event's evaluation form contest." }, { status: 400 });
    }

    const submissions = formObj.submissions;
    if (submissions.length === 0) {
      // Close form anyway
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
      // Close form
      await db.update(forms).set({ isActive: false, updatedAt: new Date() }).where(eq(forms.id, formObj.id));
      return NextResponse.json({ success: true, message: "Form closed, but no houses had submitted. No points awarded." });
    }

    // 3. Find max submission count
    let maxSubmissions = -1;
    for (const [_, count] of houseList) {
      if (count > maxSubmissions) {
        maxSubmissions = count;
      }
    }

    // 4. Find all winners (handles ties)
    const winningHouseIds = houseList.filter(([_, count]) => count === maxSubmissions).map(([hId]) => hId);

    const dbHouses = await db.query.houses.findMany();
    const houseNameMap = new Map(dbHouses.map((h) => [h.id, h.name]));

    const pointsToAward = formObj.pointsAwarded ?? 0;

    // 5. Award points in a transaction
    await db.transaction(async (tx) => {
      // Close form and mark as awarded
      await tx
        .update(forms)
        .set({ isActive: false, isAwarded: true, updatedAt: new Date() })
        .where(eq(forms.id, formObj.id));

      for (const winnerId of winningHouseIds) {
        const houseName = houseNameMap.get(winnerId) || winnerId;
        
        if (pointsToAward > 0) {
          // Update house points
          await tx
            .update(houses)
            .set({
              points: sql`${houses.points} + ${pointsToAward}`,
            })
            .where(eq(houses.id, winnerId));
        }

        const reasonStr = winningHouseIds.length > 1
          ? `Event Form Contest Tie Winner: ${houseName} House completed the evaluation form "${formObj.title}" most with ${maxSubmissions} submissions! Shared ${pointsToAward} PTS.`
          : `Event Form Contest Winner: ${houseName} House completed the evaluation form "${formObj.title}" most with ${maxSubmissions} submissions! Received ${pointsToAward} PTS.`;

        // Log score history
        await tx.insert(scoreHistory).values({
          houseId: winnerId,
          eventId: eventId,
          delta: pointsToAward,
          reason: reasonStr,
          timestamp: new Date(),
        });

        // Audit Log
        await tx.insert(auditLogs).values({
          actorId: session.user?.id,
          action: `Awarded ${pointsToAward} PTS to house ${winnerId} for evaluation form completion winner for event ${eventId}.`,
          timestamp: new Date(),
          ipAddress: 
            req.headers.get("x-forwarded-for")?.split(",")[0] ||
            req.headers.get("x-real-ip") ||
            "127.0.0.1",
        });
      }
    });

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
