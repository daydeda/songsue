import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, users, houses, scoreHistory } from "@/db/schema";
import { and, count, desc, eq, gte, isNotNull, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { unstable_cache } from "next/cache";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { captureException, logger } from "@/lib/logger";
import { effectiveRoles, isGlobalRegistrationPosition } from "@/lib/admin-access";
import { resolveFacultyViewScope, facultyRowCondition, type FacultyViewScope } from "@/lib/faculty-scope";
import type { FacultyId } from "@/lib/faculties";

// and(...) with possibly-undefined conditions, collapsing to a single
// condition (or undefined for "no filter") instead of always wrapping in
// and() — keeps the global (super_admin) path a plain unfiltered query.
function combine(...conds: (SQL | undefined)[]): SQL | undefined {
  const list = conds.filter((c): c is SQL => c !== undefined);
  if (list.length === 0) return undefined;
  return list.length === 1 ? list[0] : and(...list);
}

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

// The total event count is a genuinely global number (events aren't
// faculty-owned entities today — see src/lib/faculty-scope.ts), so it's the
// one aggregate that stays a single shared cache entry for every viewer.
const getTotalEventsCount = unstable_cache(
  async () => {
    const [row] = await db.select({ n: count() }).from(events);
    return Number(row?.n) || 0;
  },
  ["admin-dashboard-total-events"],
  { revalidate: 15, tags: ["admin-dashboard-counts"] },
);

// The expensive dashboard aggregates, cached at the app layer for 15s so polling
// admins don't each hit the DB (this is the workload that previously starved the
// pooler). Faculty-scoped (facultyKey = a FacultyId, or "ALL" for super_admin) —
// unstable_cache varies its cache entry by the arguments passed to the wrapped
// function, so each faculty gets its own 15s-cached entry and never reads
// another faculty's numbers. Dates are computed inside so each fill re-anchors
// "today" and the 30-day window itself.
const getDashboardCounts = unstable_cache(
  async (facultyKey: string) => {
    const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
    const bkkNow = new Date(Date.now() + BKK_OFFSET_MS);
    bkkNow.setUTCHours(0, 0, 0, 0);
    const startOfToday = new Date(bkkNow.getTime() - BKK_OFFSET_MS);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // users.role passed so a null-faculty STAFF row (unassigned yet) is
    // never swept into the CAMT default — only a plain student is.
    const userFacultyCond = facultyKey === "ALL" ? undefined : facultyRowCondition(users.faculty, facultyKey as FacultyId, users.role);

    const [totalUsersRow] = await db.select({ n: count() }).from(users).where(userFacultyCond);

    const [newUsers30dRow] = await db
      .select({ n: count() })
      .from(users)
      .where(combine(gte(users.createdAt, thirtyDaysAgo), userFacultyCond));

    const [checkinsTodayRow] = userFacultyCond
      ? await db
          .select({ n: count() })
          .from(attendance)
          .innerJoin(users, eq(attendance.studentId, users.id))
          .where(combine(gte(attendance.checkInTime, startOfToday), userFacultyCond))
      : await db.select({ n: count() }).from(attendance).where(gte(attendance.checkInTime, startOfToday));

    return {
      totalUsers: Number(totalUsersRow?.n) || 0,
      checkinsToday: Number(checkinsTodayRow?.n) || 0,
      newUsers30d: Number(newUsers30dRow?.n) || 0,
    };
  },
  ["admin-dashboard-counts"],
  { revalidate: 15, tags: ["admin-dashboard-counts"] },
);

const getHouseMemberCounts = unstable_cache(
  async (facultyKey: string) =>
    db
      .select({
        id: houses.id,
        name: houses.name,
        color: houses.color,
        points: houses.points,
        faculty: houses.faculty,
        colorGroup: houses.colorGroup,
        members: count(users.id),
      })
      .from(houses)
      .leftJoin(users, eq(users.houseId, houses.id))
      .where(facultyKey === "ALL" ? undefined : eq(houses.faculty, facultyKey))
      .groupBy(houses.id),
  ["admin-dashboard-house-members"],
  { revalidate: 15, tags: ["admin-dashboard-house-members"] },
);


export async function GET(req: Request) {
  try {
    const session = await withTimeout(auth(), READ_TIMEOUT_MS, "auth");
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    const globalReg = isGlobalRegistrationPosition(myRoles, session?.user?.smoPosition, session?.user?.anusmoPosition);
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "") || globalReg;
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Faculty scoping (see src/lib/faculty-scope.ts): every non-super_admin
    // viewer's stats/exports below are restricted to their own faculty. An
    // account with no faculty assigned yet gets a clear error instead of
    // silently seeing everything (global) or nothing looking like a bug
    // (all-zero cards).
    const facultyScope: FacultyViewScope = resolveFacultyViewScope(myRoles, session.user.faculty);
    if (!facultyScope.global && facultyScope.faculty === null) {
      return NextResponse.json(
        { error: "No faculty assigned to your account yet. Ask a super admin to assign one." },
        { status: 403 },
      );
    }
    const facultyCond = facultyScope.global ? undefined : facultyRowCondition(users.faculty, facultyScope.faculty, users.role);

    const type = new URL(req.url).searchParams.get("type") || "overview";

    if (type === "csv") {
      // FE-11: CSV Export
      if (!["super_admin", "admin", "registration"].includes(session.user.role || "") && !globalReg) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // Bulk PII export: keep a tamper-evident record of who pulled it (PDPA). Count
      // first (one cheap aggregate) so the audit row has the row count without
      // materializing the whole table.
      const [{ total }] = facultyCond
        ? await db.select({ total: count() }).from(attendance).innerJoin(users, eq(attendance.studentId, users.id)).where(facultyCond)
        : await db.select({ total: count() }).from(attendance);
      await AuditService.logAction({
        actorId: session.user.id!,
        action: `Exported full attendance CSV (${Number(total)} rows)${facultyScope.global ? "" : ` [faculty: ${facultyScope.faculty}]`}`,
        ipAddress: getClientIp(req),
      });

      // Stream the rows in batches instead of loading the entire (forever-growing)
      // attendance table + the whole CSV string into memory. Memory stays bounded to
      // one batch; the client receives bytes as they're produced.
      const encoder = new TextEncoder();
      const BATCH = 1000;
      const header = "Event_Title,Student_ID,Name,Major,Check_In_Time,Method\n";
      let offset = 0;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("\ufeff" + header)); // BOM + header
        },
        async pull(controller) {
          try {
            // A relational `with: { user }` query can't filter by the related
            // user's faculty, so this is a flat select+join instead (also lets
            // the faculty filter apply consistently across every page).
            const batch = await db
              .select({
                eventTitle: events.title,
                studentId: users.studentId,
                name: users.name,
                major: users.major,
                checkInTime: attendance.checkInTime,
                method: attendance.method,
              })
              .from(attendance)
              .leftJoin(events, eq(attendance.eventId, events.id))
              .innerJoin(users, eq(attendance.studentId, users.id))
              .where(facultyCond)
              .orderBy(desc(attendance.checkInTime))
              .limit(BATCH)
              .offset(offset);
            if (batch.length === 0) {
              controller.close();
              return;
            }
            offset += batch.length;
            let chunk = "";
            for (const a of batch) {
              chunk += [a.eventTitle, a.studentId, a.name, a.major, a.checkInTime, a.method]
                .map(csvCell)
                .join(",") + "\n";
            }
            controller.enqueue(encoder.encode(chunk));
            if (batch.length < BATCH) controller.close();
          } catch (e) {
            controller.error(e);
          }
        },
      });

      return new NextResponse(stream, {
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

    // Default: Overview stats. The expensive, every-10s-polled aggregates (4 counts +
    // the house member GROUP BY) are cached at the app layer for 15s so DB cost is
    // decoupled from how many admins are polling — the workload that used to starve
    // the pooler. Recent activity below stays live (cheap, limit 10). Check-ins-today
    // is anchored to Bangkok midnight inside getDashboardCounts (UTC+7, no DST).
    // facultyKey is non-null here — the null-scope case already returned above.
    const facultyKey = facultyScope.global ? "ALL" : (facultyScope.faculty as FacultyId);

    const totalEvents = await withTimeout(getTotalEventsCount(), READ_TIMEOUT_MS, "totalEvents");
    const { totalUsers, checkinsToday, newUsers30d } = await withTimeout(
      getDashboardCounts(facultyKey),
      READ_TIMEOUT_MS,
      "counts"
    );
    // Growth = new arrivals / what existed before the window. If there's no prior
    // base (brand-new platform — everyone registered within the window), growth %
    // is meaningless, so return 0 and let the card hide the badge until a real
    // baseline exists (students older than 30 days to compare against).
    const priorUsers = totalUsers - newUsers30d;
    const userGrowthPct = priorUsers > 0 ? Math.round((newUsers30d / priorUsers) * 100) : 0;

    const houseListWithMembers = await withTimeout(
      getHouseMemberCounts(facultyKey),
      READ_TIMEOUT_MS,
      "houses"
    );

    // Flat select+join instead of a relational `with: { user }` query — the
    // latter can't filter by the related user's faculty.
    const recentCheckins = await withTimeout(
      db
        .select({
          name: users.name,
          nickname: users.nickname,
          eventTitle: events.title,
          checkInTime: attendance.checkInTime,
        })
        .from(attendance)
        .leftJoin(users, eq(attendance.studentId, users.id))
        .leftJoin(events, eq(attendance.eventId, events.id))
        // Only genuine check-ins. Registration rows have checkInTime = null, and
        // `ORDER BY ... DESC` is NULLS FIRST in Postgres, so without this filter
        // those un-checked-in rows sort to the top and fall back to new Date()
        // below — making every Recent Activity entry show the current time.
        .where(combine(isNotNull(attendance.checkInTime), facultyCond))
        .orderBy(desc(attendance.checkInTime))
        .limit(10),
      READ_TIMEOUT_MS,
      "checkins"
    );

    // Left-joined to houses so a faculty filter naturally excludes house-less
    // activity rows for a scoped viewer (NULL never matches eq(houseFaculty,
    // X)) while a global viewer keeps seeing them, exactly as before.
    const recentScores = await withTimeout(
      db
        .select({
          id: scoreHistory.id,
          delta: scoreHistory.delta,
          reason: scoreHistory.reason,
          timestamp: scoreHistory.timestamp,
          houseId: houses.id,
          houseName: houses.name,
          houseColor: houses.color,
        })
        .from(scoreHistory)
        .leftJoin(houses, eq(scoreHistory.houseId, houses.id))
        .where(facultyScope.global ? undefined : eq(houses.faculty, facultyScope.faculty as FacultyId))
        .orderBy(desc(scoreHistory.timestamp))
        .limit(10),
      READ_TIMEOUT_MS,
      "scores"
    );

    // Merge and sort
    const mergedActivity = [
      ...recentCheckins.map(a => ({
        type: "checkin" as const,
        studentName: a.name ?? "Unknown",
        studentNickname: a.nickname ?? "",
        eventTitle: a.eventTitle ?? "Unknown Event",
        timestamp: a.checkInTime?.toISOString() || new Date().toISOString(),
      })),
      ...recentScores.map(s => ({
        type: "score" as const,
        houseId: s.houseId,
        houseName: s.houseName ?? "Unknown",
        houseColor: s.houseColor ?? "var(--accent-primary)",
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
        faculty: h.faculty,
        colorGroup: h.colorGroup,
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
