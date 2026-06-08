import { db } from "@/db";
import { scoreHistory } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const list = await db.query.scoreHistory.findMany({
      limit: 20,
      orderBy: [desc(scoreHistory.timestamp)],
      with: {
        house: {
          columns: {
            id: true,
            name: true,
            color: true,
          }
        },
        event: {
          columns: {
            title: true,
          }
        }
      }
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch house activity:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
