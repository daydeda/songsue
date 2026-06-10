import { db } from "@/db";
import { houses } from "@/db/schema";
import { NextResponse } from "next/server";

// Fail fast instead of hanging to the 300s platform default if the DB pooler stalls.
export const maxDuration = 20;

export async function GET() {
  try {
    const list = await db.query.houses.findMany({
      columns: {
        id: true,
        name: true,
        color: true,
        points: true,
      },
      orderBy: (houses, { desc }) => [desc(houses.points)],
    });

    return NextResponse.json(list, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
