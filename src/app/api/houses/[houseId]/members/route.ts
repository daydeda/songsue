import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { houseIdFromParam } from "@/lib/houses";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ houseId: string }> }
) {
  try {
    // The URL carries a name slug ("mom"); resolve it to the DB house id ("red").
    // Raw colour ids still resolve to themselves, so old links keep working.
    const houseId = houseIdFromParam((await params).houseId);

    // PDPA: a house roster exposes real student names — authenticated users only.
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Members are visible only to students of that same house. The URL is guessable
    // (e.g. /api/houses/mom/members), so this guard — not just the hidden link on the
    // leaderboard — is what actually enforces the "your own house only" rule.
    if (session.user.houseId !== houseId) {
      return NextResponse.json(
        { error: "Forbidden: you can only view your own house" },
        { status: 403 }
      );
    }

    // Fetch the house itself + its roster in parallel. The house lookup confirms the
    // id is real (returns 404 otherwise) and supplies the header name/colour.
    const [house, members] = await Promise.all([
      db.query.houses.findFirst({
        where: (houses, { eq }) => eq(houses.id, houseId),
        columns: { id: true, name: true, color: true, points: true },
      }),
      db.query.users.findMany({
        where: and(eq(users.houseId, houseId), eq(users.profileCompleted, true)),
        columns: {
          id: true,
          name: true,
          nickname: true,
          points: true,
        },
        // Deterministic tie-break: equal points sort by id so rows don't shuffle
        // between refreshes (matches the leaderboard ordering).
        orderBy: (users, { desc, asc }) => [desc(users.points), asc(users.id)],
      }),
    ]);

    if (!house) {
      return NextResponse.json({ error: "House not found" }, { status: 404 });
    }

    return NextResponse.json(
      { house, members },
      {
        headers: {
          // Private: contains student PII and is auth-gated, so the shared CDN must
          // not store it. Per-browser caching only (mirrors /api/houses/individual).
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch house members:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
