import { db } from "@/db";
import { checkAndAwardClosedForms } from "@/lib/award-points";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { captureException } from "@/lib/logger";

// Fail fast instead of hanging to the 300s platform default if the DB pooler stalls.
export const maxDuration = 20;

// Cache the standings read at the app layer for 30s. The s-maxage header below only
// helps when a CDN honors it (Vercel did); self-hosted behind plain nginx there is
// no CDN, so without this every student device polling the leaderboard would hit the
// DB. 30s staleness matches the previous s-maxage behavior. Revalidate the
// "house-standings" tag after a points write to refresh sooner.
const getHouseStandings = unstable_cache(
  () =>
    db.query.houses.findMany({
      columns: {
        id: true,
        name: true,
        color: true,
        points: true,
      },
      orderBy: (houses, { desc }) => [desc(houses.points)],
    }),
  ["house-standings"],
  { revalidate: 15, tags: ["house-standings"] },
);

export async function GET() {
  try {
    // Settle any form whose scheduled close has passed before reading standings, so
    // the scoreboard a student loads reflects the latest contest result. Cheap
    // indexed no-op when nothing is pending; the actual award runs once per form.
    await checkAndAwardClosedForms();

    const list = await getHouseStandings();

    return NextResponse.json(list, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    captureException(error, { route: "GET /api/houses" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
