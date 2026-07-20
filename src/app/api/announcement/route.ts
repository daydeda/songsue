import { db } from "@/db";
import { announcements } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { captureException } from "@/lib/logger";
import { isFacultyId, type FacultyId } from "@/lib/faculties";

// Cache the per-faculty read at the app layer for 30s. The s-maxage header only
// helps behind a CDN (Vercel); self-hosted behind plain nginx there is none, so
// without this every student device polling the banner hits the DB. faculty is
// part of the wrapped function's arguments, so each faculty gets its own cache
// entry (mirrors getDashboardCounts in /api/admin/dashboard) — editing one
// faculty's announcement never serves stale content for another.
const getAnnouncement = unstable_cache(
  async (faculty: FacultyId) => {
    const [row] = await db
      .select({ body: announcements.body, enabled: announcements.enabled })
      .from(announcements)
      .where(eq(announcements.faculty, faculty))
      .orderBy(desc(announcements.updatedAt))
      .limit(1);
    return row ?? null;
  },
  ["dashboard-announcement"],
  { revalidate: 30, tags: ["dashboard-announcement"] },
);

// GET /api/announcement?faculty=CAMT — public. Returns the dashboard
// announcement ({ body, enabled }) for the given faculty, read by the student
// dashboard banner. Faculty is per-student (a plain, non-sensitive field), so
// it's passed as a query param rather than resolved from a session. Returns
// null (banner hidden) if faculty is missing/invalid or that faculty has no
// announcement row yet — there is no cross-faculty fallback.
//
// CDN-cached (mirrors /api/houses): the banner changes a few times a week at most,
// but every student device polls it. s-maxage lets the edge serve it without
// invoking the function for 30s, so an edit appears within ~30s instead of hitting
// the DB on every poll.
export async function GET(req: Request) {
  try {
    const faculty = new URL(req.url).searchParams.get("faculty");
    if (!isFacultyId(faculty)) {
      return NextResponse.json(null, {
        headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
      });
    }

    const row = await getAnnouncement(faculty);

    return NextResponse.json(row ?? null, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    captureException(error, { route: "GET /api/announcement" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
