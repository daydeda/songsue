import { db } from "@/db";
import { houses } from "@/db/schema";
import { NextResponse } from "next/server";

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

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
