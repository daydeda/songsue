import { db } from "@/db";
import { houses, scoreHistory, users } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { COLORS, DEFAULT_FACULTY, normalizeFaculty } from "@/lib/faculties";

export class HousesService {
  /**
   * Picks the house a new STUDENT should join for balanced distribution (FE-03):
   * the house with the fewest members right now (counting everyone). Ties resolve
   * to the first such house by query order. Used by the onboarding profile submit.
   *
   * Staff are balanced separately — see pickBalancedHouseIdForStaff — so that the
   * (much larger) student population doesn't skew where staff land.
   *
   * Returns the house id, or null if no houses exist yet (caller leaves houseId
   * unset rather than crashing).
   */
  static async pickBalancedHouseId(): Promise<string | null> {
    const housesList = await db.query.houses.findMany({
      with: { users: { columns: { id: true } } },
    });
    if (housesList.length === 0) return null;
    const sorted = [...housesList].sort((a, b) => a.users.length - b.users.length);
    return sorted[0].id;
  }

  /**
   * Picks the colour house a student should join WITHIN their faculty: the
   * faculty house (one of 4 colours) with the fewest members right now. Ties
   * resolve to the first such house by query order. Called at first check-in
   * (ScannerService.ensureHouseAssigned), since houses are no longer assigned at
   * onboarding.
   *
   * `faculty` is normalised to CAMT when null/unknown for back-compat. Returns
   * the house id, or null if that faculty has no houses seeded yet.
   */
  static async pickBalancedHouseIdForFaculty(faculty: string | null | undefined): Promise<string | null> {
    const fac = normalizeFaculty(faculty);
    const housesList = await db.query.houses.findMany({
      where: eq(houses.faculty, fac),
      with: { users: { columns: { id: true } } },
    });
    if (housesList.length === 0) return null;
    const sorted = [...housesList].sort((a, b) => a.users.length - b.users.length);
    return sorted[0].id;
  }

  /**
   * Picks the house a new STAFF member should join for balanced staff
   * distribution: the house with the fewest `staff`-role members right now,
   * counting ONLY staff (students are ignored). Ties resolve to the first such
   * house by query order. Used by the staff onboarding-bypass provisioning so
   * staff spread evenly across houses independently of the student population.
   *
   * Returns the house id, or null if no houses exist yet (caller leaves houseId
   * unset rather than crashing).
   */
  static async pickBalancedHouseIdForStaff(faculty: string | null | undefined = DEFAULT_FACULTY): Promise<string | null> {
    const fac = normalizeFaculty(faculty);
    // Scope to the staff member's faculty so staff land in one of their own
    // faculty's 4 colour houses (not spread across all 16).
    const housesList = await db.query.houses.findMany({
      where: eq(houses.faculty, fac),
      columns: { id: true },
    });
    if (housesList.length === 0) return null;
    const houseIds = housesList.map((h) => h.id);

    // Count only staff-role members per house, within this faculty. Houses with
    // zero staff don't appear in these rows, so default them to 0 when ranking.
    const staffCounts = await db
      .select({ houseId: users.houseId, count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "staff"), inArray(users.houseId, houseIds)))
      .groupBy(users.houseId);

    const countByHouse = new Map(staffCounts.map((r) => [r.houseId, r.count]));
    const sorted = [...housesList].sort(
      (a, b) => (countByHouse.get(a.id) ?? 0) - (countByHouse.get(b.id) ?? 0),
    );
    return sorted[0].id;
  }

  /**
   * Adjusts house points atomically inside a database transaction,
   * inserts a record into score history, and writes an audit log.
   */
  static async adjustHousePoints(params: {
    houseId: string;
    delta: number;
    reason: string;
    actorId?: string;
    ipAddress?: string;
    eventId?: string;
  }) {
    const { houseId, delta, reason, actorId, ipAddress, eventId } = params;

    const result = await db.transaction(async (tx) => {
      // 1. Update house points atomically
      await tx
        .update(houses)
        .set({
          points: sql`${houses.points} + ${delta}`,
        })
        .where(eq(houses.id, houseId));

      // 2. Log score history
      const [historyRecord] = await tx
        .insert(scoreHistory)
        .values({
          houseId,
          delta,
          reason,
          eventId: eventId || null,
          timestamp: new Date(),
        })
        .returning();

      // 3. Write Audit Log (decoupled call to AuditService)
      if (actorId) {
        await AuditService.logActionInternal(tx, {
          actorId,
          action: `Adjusted house ${houseId} points by ${delta}. Reason: ${reason}`,
          ipAddress: ipAddress || "127.0.0.1",
        });
      }

      return { historyRecord };
    });

    return result?.historyRecord;
  }

  /**
   * Public leaderboard: the 4 colour houses with points ROLLED UP across
   * faculties (CAMT red + MASSCOM red + … = one "red" total), sorted high→low.
   * The returned `id` is the colour group ('red'/'green'/'yellow'/'blue'), which
   * the house pages slug-map and link to exactly like the old per-colour rows.
   */
  static async getLeaderboard() {
    const rows = await db
      .select({
        colorGroup: houses.colorGroup,
        points: sql<number>`sum(${houses.points})::int`,
      })
      .from(houses)
      .groupBy(houses.colorGroup);

    const pointsByColor = new Map(rows.map((r) => [r.colorGroup, r.points]));
    return COLORS.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      points: pointsByColor.get(c.id) ?? 0,
    })).sort((a, b) => b.points - a.points);
  }

  /**
   * Per-faculty breakdown for a single colour group — the four (or fewer)
   * faculty houses that make up one rolled-up colour, with their individual
   * points. Used by the colour house detail view.
   */
  static async getFacultyBreakdown(colorGroup: string) {
    return await db.query.houses.findMany({
      where: eq(houses.colorGroup, colorGroup),
      orderBy: (houses, { desc }) => [desc(houses.points)],
    });
  }

  /**
   * Fetch recent score history logs
   */
  static async getRecentActivity(limit = 50) {
    return await db.query.scoreHistory.findMany({
      orderBy: (scoreHistory, { desc }) => [desc(scoreHistory.timestamp)],
      limit,
      with: {
        house: true,
        event: true,
      },
    });
  }
}
