import { db } from "@/db";
import { users } from "@/db/schema";
import { or, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const list = await db.query.users.findMany({
      where: or(eq(users.role, "student"), gt(users.points, 0)),
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
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch individual leaderboard:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
