import { auth } from "@/auth";
import { db } from "@/db";
import { houses, scoreHistory, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { houseId, delta, reason } = await req.json();

    if (!houseId || delta === undefined || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const parsedDelta = parseInt(delta);
    if (isNaN(parsedDelta)) {
      return NextResponse.json({ error: "Invalid delta" }, { status: 400 });
    }

    // FE-08: Atomic point update
    await db.transaction(async (tx) => {
      // 1. Update house points
      await tx
        .update(houses)
        .set({
          points: sql`${houses.points} + ${parsedDelta}`,
        })
        .where(eq(houses.id, houseId));

      // 2. Log score history
      await tx.insert(scoreHistory).values({
        houseId,
        delta: parsedDelta,
        reason,
      });

      // 3. Audit log
      await tx.insert(auditLogs).values({
        actorId: session.user?.id,
        action: `Adjusted house ${houseId} points by ${parsedDelta}. Reason: ${reason}`,
        timestamp: new Date(),
        ipAddress: 
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          req.headers.get("x-real-ip") ||
          "127.0.0.1",
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update house points:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
