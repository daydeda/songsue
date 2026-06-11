import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    // Default to the full leaderboard (the standings page paginates client-side).
    // The 2000 ceiling is just a safety valve against a pathological payload — the
    // result set is small (a few hundred students), the response is edge-cached for
    // 30s, and the page only renders 10 rows at a time, so returning all is cheap.
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get("limit") || "2000")));
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
