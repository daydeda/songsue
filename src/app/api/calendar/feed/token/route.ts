import { auth } from "@/auth";
import { db } from "@/db";
import { calendarFeedTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

// 256-bit unguessable secret — the bearer credential for the .ics feed URL.
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// GET /api/calendar/feed/token — return the caller's feed token, lazily creating
// one on first request so the Subscribe panel always has a URL to show.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;

  let row = await db.query.calendarFeedTokens.findFirst({
    where: eq(calendarFeedTokens.userId, userId),
  });
  if (!row) {
    await db
      .insert(calendarFeedTokens)
      .values({ userId, token: newToken() })
      .onConflictDoNothing();
    row = await db.query.calendarFeedTokens.findFirst({
      where: eq(calendarFeedTokens.userId, userId),
    });
  }

  return NextResponse.json({ token: row?.token ?? null });
}

// POST /api/calendar/feed/token — rotate: issue a new token, instantly killing
// the old subscribe URL.
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id!;
  const token = newToken();

  const [row] = await db
    .insert(calendarFeedTokens)
    .values({ userId, token })
    .onConflictDoUpdate({
      target: calendarFeedTokens.userId,
      set: { token, createdAt: new Date(), lastUsedAt: null },
    })
    .returning();

  return NextResponse.json({ token: row.token });
}

// DELETE /api/calendar/feed/token — revoke entirely (no active feed afterwards).
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db
    .delete(calendarFeedTokens)
    .where(eq(calendarFeedTokens.userId, session.user.id!));
  return NextResponse.json({ success: true });
}
