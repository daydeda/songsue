import { auth } from "@/auth";
import { db } from "@/db";
import { houses } from "@/db/schema";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const list = await db.query.houses.findMany({
      columns: {
        id: true,
        name: true,
        color: true,
        points: true,
      }
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch houses:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
