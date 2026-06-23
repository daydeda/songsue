import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users, houses } from "@/db/schema";
import { count, gte, sql, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { AuditService } from "@/modules/audit/audit.service";
import { captureException, logger } from "@/lib/logger";

// Hard ceiling: a request must never hang at the platform's 300s default. If a DB
// call stalls (e.g. the Supabase pooler is momentarily queueing), fail fast at 20s,
// release the connection, and let the client's next poll retry — instead of holding
// a zombie function (and its pooled connection) for 5 minutes.
export const maxDuration = 20;

// Application-level deadline, deliberately shorter than maxDuration. If the DB work
// can't finish in time (almost always a connection that's waiting on the Supabase
// pooler rather than a genuinely slow query — the DB is tiny), we return a fast 503
// and let the client's poll retry, instead of holding the function (and its pooled
// connection) hostage until the platform 504s it at 20s. The orphaned query settles
// on its own later; the process-level unhandledRejection guard in src/db keeps a
// late rejection from crashing the instance.
const READ_TIMEOUT_MS = 8000;

class TimeoutError extends Error {}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(label)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}


export async function GET(req: Request) {
  try {
    const session = await withTimeout(auth(), READ_TIMEOUT_MS, "auth");
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const type = new URL(req.url).searchParams.get("type") || "overview";

    if (type === "csv") {
      // FE-11: CSV Export
      if (!["super_admin", "admin", "registration"].includes(session.user.role || "")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const allAtt = await db.query.attendance.findMany({
        with: {
          user: { columns: { studentId: true, name: true, major: true } },
          event: { columns: { title: true } },
        },
        orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
      });

      // Bulk PII export: keep a tamper-evident record of who pulled it (PDPA).
      await AuditService.logAction({
        actorId: session.user.id!,
        action: `Exported full attendance CSV (${allAtt.length} rows)`,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          req.headers.get("x-real-ip") ||
          "127.0.0.1",
      });

      let csv = "Event_Title,Student_ID,Name,Major,Check_In_Time,Method\n";
      allAtt.forEach((a) => {
        csv += [a.event?.title, a.user?.studentId, a.user?.name, a.user?.major, a.checkInTime, a.method]
          .map(csvCell)
          .join(",") + "\n";
      });

      const csvWithBom = "\ufeff" + csv;

      return new NextResponse(csvWithBom, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activecamt_attendance_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // NOTE: event-winner awarding is intentionally NOT done here. This is the
    // highest-frequency polled endpoint; doing transactional write work in its
    // request path previously held pooled DB connections long enough to starve the
    // Supabase pooler and 504 the whole site. Awarding now lives in its own
    // endpoint (/api/admin/award-check), pinged fire-and-forget by the client, and
    // in the daily cron. This route is a pure, fast read.

    // Default: Overview stats
    // FE-08: Check-ins today — anchored to Bangkok midnight (UTC+7), not the
    // server's UTC midnight. Otherwise scans between 00:00–07:00 Bangkok count
    // toward the previous day. Bangkok has no DST so a fixed +7h offset is exact.
    const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
    const bkkNow = new Date(Date.now() + BKK_OFFSET_MS);
    bkkNow.setUTCHours(0, 0, 0, 0);
    const startOfToday = new Date(bkkNow.getTime() - BKK_OFFSET_MS);

    // Total Students growth %: students registered in the last 30 days, expressed
    // as growth over the count that existed before that window. Folded into the
    // single counts query below as one extra subquery — no extra round-trip or
    // pooled connection (the cost the rest of this file is careful about).
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch dashboard statistics sequentially to avoid database connection pool starvation.
    // Sequential execution uses exactly 1 connection at a time (peak demand = 1), whereas
    // Promise.all with 7 queries requested 7 connections simultaneously, exceeding the
    // max: 5 pool limit and causing statement timeouts under concurrent load.
    const countsResult = await withTimeout(
      db.execute(sql`
        SELECT 
          (SELECT count(*)::int FROM ${users}) AS "totalUsers",
          (SELECT count(*)::int FROM ${events}) AS "totalEvents",
          (SELECT count(*)::int FROM ${attendance} WHERE ${attendance.checkInTime} >= ${startOfToday.toISOString()}) AS "checkinsToday",
          (SELECT count(*)::int FROM ${users} WHERE ${users.createdAt} >= ${thirtyDaysAgo.toISOString()}) AS "newUsers30d"
      `),
      READ_TIMEOUT_MS,
      "counts"
    );
    const totalUsers = (countsResult[0]?.totalUsers as number) ?? 0;
    const totalEvents = (countsResult[0]?.totalEvents as number) ?? 0;
    const checkinsToday = (countsResult[0]?.checkinsToday as number) ?? 0;
    const newUsers30d = (countsResult[0]?.newUsers30d as number) ?? 0;
    // Growth = new arrivals / what existed before the window. If there's no prior
    // base (brand-new platform — everyone registered within the window), growth %
    // is meaningless, so return 0 and let the card hide the badge until a real
    // baseline exists (students older than 30 days to compare against).
    const priorUsers = totalUsers - newUsers30d;
    const userGrowthPct = priorUsers > 0 ? Math.round((newUsers30d / priorUsers) * 100) : 0;

    const houseListWithMembers = await withTimeout(
      db
        .select({
          id: houses.id,
          name: houses.name,
          color: houses.color,
          points: houses.points,
          members: count(users.id),
        })
        .from(houses)
        .leftJoin(users, eq(users.houseId, houses.id))
        .groupBy(houses.id),
      READ_TIMEOUT_MS,
      "houses"
    );

    const recentCheckins = await withTimeout(
      db.query.attendance.findMany({
        limit: 10,
        // Only genuine check-ins. Registration rows have checkInTime = null, and
        // `ORDER BY ... DESC` is NULLS FIRST in Postgres, so without this filter
        // those un-checked-in rows sort to the top and fall back to new Date()
        // below — making every Recent Activity entry show the current time.
        where: (attendance, { isNotNull }) => isNotNull(attendance.checkInTime),
        orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
        with: {
          user: { columns: { name: true, nickname: true } },
          event: { columns: { title: true } },
        },
      }),
      READ_TIMEOUT_MS,
      "checkins"
    );

    const recentScores = await withTimeout(
      db.query.scoreHistory.findMany({
        limit: 10,
        orderBy: (scoreHistory, { desc }) => [desc(scoreHistory.timestamp)],
        columns: {
          id: true,
          delta: true,
          reason: true,
          timestamp: true,
        },
        with: {
          house: { columns: { id: true, name: true, color: true } },
        },
      }),
      READ_TIMEOUT_MS,
      "scores"
    );

    // Merge and sort
    const mergedActivity = [
      ...recentCheckins.map(a => ({
        type: "checkin" as const,
        studentName: a.user?.name ?? "Unknown",
        studentNickname: a.user?.nickname ?? "",
        eventTitle: a.event?.title ?? "Unknown Event",
        timestamp: a.checkInTime?.toISOString() || new Date().toISOString(),
      })),
      ...recentScores.map(s => ({
        type: "score" as const,
        houseId: s.house?.id,
        houseName: s.house?.name ?? "Unknown",
        houseColor: s.house?.color ?? "var(--accent-primary)",
        delta: s.delta,
        reason: s.reason,
        timestamp: s.timestamp?.toISOString() || new Date().toISOString(),
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

    return NextResponse.json({
      totalUsers,
      totalEvents,
      checkinsToday,
      userGrowthPct,
      recentActivity: mergedActivity,
      houses: houseListWithMembers.map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        points: h.points ?? 0,
        members: Number(h.members) ?? 0,
      })),
    });
  } catch (error) {
    // A deadline miss is a transient pooler/connection stall, not a real error.
    // Return 503 so the client's next poll retries quickly, and tell it when.
    if (error instanceof TimeoutError) {
      // Transient pooler/connection stall — log at warn, don't alert.
      logger.warn("dashboard read timed out; returning 503", { message: error.message });
      return NextResponse.json(
        { error: "Service busy, retrying shortly" },
        { status: 503, headers: { "Retry-After": "5" } },
      );
    }
    captureException(error, { route: "GET /api/admin/dashboard" });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
