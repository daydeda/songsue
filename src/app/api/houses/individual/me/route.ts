import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

// Returns the current user's individual standing: their points, their exact
// rank across all profile-completed students, and the total student count.
// Rank is computed in SQL (count of students with strictly more points + 1) so
// it stays correct even when the user is outside the top-50 leaderboard list.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const me = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { points: true, profileCompleted: true },
    });

    if (!me || !me.profileCompleted) {
      return NextResponse.json({ points: 0, rank: null, total: 0 });
    }

    const myPoints = me.points ?? 0;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.profileCompleted, true));

    // With 0 points you haven't earned a position yet — and when everyone is at 0
    // a numeric rank would just tie everybody at #1, which is misleading. Report
    // rank: null ("Unranked") until at least 1 point is earned.
    if (myPoints <= 0) {
      return NextResponse.json(
        { points: myPoints, rank: null, total: Number(total) },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const [{ ahead }] = await db
      .select({ ahead: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.profileCompleted, true), gt(users.points, myPoints)));

    return NextResponse.json(
      { points: myPoints, rank: Number(ahead) + 1, total: Number(total) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Failed to fetch individual standing:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
