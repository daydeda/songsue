import { db } from "@/db";
import { gameRooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { captureException } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { effectiveRoles } from "@/lib/admin-access";
import { canAccessBattle } from "@/lib/battle-access";

// POST /api/battle/rooms/[code]/join - Guest joins a room
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canAccessBattle(effectiveRoles(session.user.role, session.user.roles))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { code } = await params;
    const roomCode = code.toUpperCase();
    const guestId = session.user.id;

    // Room codes are only 4 chars (~1M combinations) — throttle per user so a
    // signed-in account can't brute-force codes. Durable Postgres-backed window.
    const limiter = await rateLimit(`battle:join:${guestId}`, 10, 60000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Too many join attempts. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limiter.resetTime - Date.now()) / 1000))) } }
      );
    }

    // Verify guest user exists in database (handles stale session cookies after database resets)
    const guestExists = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, guestId),
      columns: { id: true }
    });
    if (!guestExists) {
      return NextResponse.json({ error: "User not found in database. Please log out and sign in again." }, { status: 401 });
    }

    const room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status === "waiting" && room.expiresAt < new Date()) {
      await db.update(gameRooms)
        .set({ status: "expired" })
        .where(eq(gameRooms.id, room.id));
      return NextResponse.json({ error: "Room has expired" }, { status: 400 });
    }

    if (room.status !== "waiting") {
      return NextResponse.json({ error: "Room is not joinable" }, { status: 400 });
    }

    if (room.hostId === guestId) {
      return NextResponse.json({ error: "You cannot join your own room" }, { status: 400 });
    }

    await db.update(gameRooms)
      .set({
        guestId,
        status: "connecting",
        updatedAt: new Date(),
      })
      .where(eq(gameRooms.id, room.id));

    // Joining a room is NOT audit-logged (US-FIX-20i AC-3 decision): the audit_logs
    // hash chain is reserved for compliance-relevant events. For games only room
    // creation and game finish are kept; join volume would bloat the chain.

    return NextResponse.json({
      roomId: room.id,
      roomCode: room.roomCode,
      gameType: room.gameType,
      status: "connecting",
      hostId: room.hostId,
      guestId,
    });

  } catch (error) {
    captureException(error, { route: "POST /api/battle/rooms/[code]/join" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
