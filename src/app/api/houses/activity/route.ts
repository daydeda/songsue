import { auth } from "@/auth";
import { db } from "@/db";
import { scoreHistory } from "@/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // PDPA: score-history reason strings can embed student names — auth required.
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
