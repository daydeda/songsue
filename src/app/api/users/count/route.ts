import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    const [{ count: countVal }] = await db.select({ count: count() }).from(users);
    return NextResponse.json({ count: countVal });
  } catch (err) {
    console.error("Failed to fetch user count:", err);
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}
