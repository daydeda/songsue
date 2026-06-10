import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const offset = (page - 1) * limit;

    const list = await db.query.users.findMany({
      where: eq(users.profileCompleted, true),
      columns: {
        id: true,
        name: true,
        nickname: true,
        points: true,
        houseId: true,
      },
      with: {
        house: {
          columns: {
            name: true,
            color: true,
          },
        },
      },
      orderBy: (users, { desc }) => [desc(users.points)],
      limit: limit,
      offset: offset,
    });

    return NextResponse.json(list, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Failed to fetch individual leaderboard:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
