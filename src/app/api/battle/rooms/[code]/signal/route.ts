import { db } from "@/db";
import { webrtcSignals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { captureException } from "@/lib/logger";

// POST /api/battle/rooms/[code]/signal - Upload my WebRTC signals (SDP/ICE)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const roomCode = code.toUpperCase();
    const userId = session.user.id;

    const room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostId !== userId && room.guestId !== userId) {
      return NextResponse.json({ error: "Unauthorized to access this room" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const role = body.role as "host" | "guest";
    const { sdpOffer, sdpAnswer, iceCandidates } = body;

    if (!role || (role === "host" && room.hostId !== userId) || (role === "guest" && room.guestId !== userId)) {
      return NextResponse.json({ error: "Invalid role for this user" }, { status: 400 });
    }

    const existing = await db.query.webrtcSignals.findFirst({
      where: (s, { eq, and }) => and(eq(s.roomId, room.id), eq(s.role, role)),
    });

    if (existing) {
      await db.update(webrtcSignals)
        .set({
          sdpOffer: sdpOffer !== undefined ? sdpOffer : existing.sdpOffer,
          sdpAnswer: sdpAnswer !== undefined ? sdpAnswer : existing.sdpAnswer,
          iceCandidates: iceCandidates !== undefined ? iceCandidates : existing.iceCandidates,
          updatedAt: new Date(),
        })
        .where(eq(webrtcSignals.id, existing.id));
    } else {
      await db.insert(webrtcSignals).values({
        roomId: room.id,
        role,
        sdpOffer: sdpOffer || null,
        sdpAnswer: sdpAnswer || null,
        iceCandidates: iceCandidates || [],
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    captureException(error, { route: "POST /api/battle/rooms/[code]/signal" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET /api/battle/rooms/[code]/signal - Retrieve opponent's WebRTC signals (SDP/ICE)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const roomCode = code.toUpperCase();
    const userId = session.user.id;

    const room = await db.query.gameRooms.findFirst({
      where: (r, { eq }) => eq(r.roomCode, roomCode),
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.hostId !== userId && room.guestId !== userId) {
      return NextResponse.json({ error: "Unauthorized to access this room" }, { status: 403 });
    }

    const myRole = room.hostId === userId ? "host" : "guest";
    const opponentRole = myRole === "host" ? "guest" : "host";

    const opponentSignal = await db.query.webrtcSignals.findFirst({
      where: (s, { eq, and }) => and(eq(s.roomId, room.id), eq(s.role, opponentRole)),
    });

    return NextResponse.json({
      role: opponentRole,
      sdpOffer: opponentSignal?.sdpOffer || null,
      sdpAnswer: opponentSignal?.sdpAnswer || null,
      iceCandidates: opponentSignal?.iceCandidates || [],
      updatedAt: opponentSignal?.updatedAt || null,
    });

  } catch (error) {
    captureException(error, { route: "GET /api/battle/rooms/[code]/signal" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
