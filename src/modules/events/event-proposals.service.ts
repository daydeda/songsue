import { db } from "@/db";
import { clubs, eventProposals } from "@/db/schema";
import { EventScopeService } from "@/modules/events/event-scope.service";
import { desc, eq } from "drizzle-orm";

export class EventProposalsService {
  /**
   * Resolves the club ids a club_president may propose for — reuses
   * EventScopeService.getPresidentScope so "which clubs can I act on" stays a
   * single source of truth shared with event ownership scoping.
   */
  static async getSubmittableClubIds(userId: string, roles: string[]): Promise<string[]> {
    const scope = await EventScopeService.getPresidentScope(userId, roles);
    return scope.clubIds;
  }

  /**
   * Resolves the major code(s) a major_president may propose for — same
   * scope object as above, just the majors[] side of it. In practice this is
   * at most one major (a president's own users.major), but returned as a list
   * to mirror getSubmittableClubIds's shape.
   */
  static async getSubmittableMajors(userId: string, roles: string[]): Promise<string[]> {
    const scope = await EventScopeService.getPresidentScope(userId, roles);
    return scope.majors;
  }

  /**
   * Lists proposals for a viewer: staff (isStaff=true) see everything,
   * optionally filtered by status; a club_president sees only proposals for
   * clubs they preside over, a major_president only proposals for their own
   * major. Never trusts a client-supplied scope — always re-resolves it from
   * the viewer's own userId/roles.
   *
   * `type`, when passed ('club' | 'major'), further restricts the result to
   * only club-owned or only major-owned rows. This exists because a single
   * user can hold BOTH club_president and major_president roles at once —
   * without this, /admin/clubs's club-only UI and /admin/majors's major-only
   * UI would otherwise both call the same unfiltered endpoint and end up
   * showing each other's proposals mixed in (a club row has no `club`
   * relation to render on the majors page and vice versa).
   */
  static async listForViewer(userId: string, roles: string[], isStaff: boolean, status?: string | null, type?: string | null) {
    const scope = isStaff ? null : await EventScopeService.getPresidentScope(userId, roles);
    if (!isStaff && scope!.clubIds.length === 0 && scope!.majors.length === 0) return [];

    const rows = await db.query.eventProposals.findMany({
      where: status ? eq(eventProposals.status, status) : undefined,
      orderBy: [desc(eventProposals.createdAt)],
      with: {
        club: { columns: { id: true, name: true, isArchived: true } },
        proposer: { columns: { id: true, name: true, studentId: true } },
      },
    });

    // No pagination for v1 — mirrors the existing /api/admin/appeals precedent
    // of fetch-all + client-side paging at this data volume. A row is either
    // club-owned or major-owned (clubId/majorCode are mutually exclusive, see
    // schema.ts), so exactly one of these two checks can ever match.
    const scoped = isStaff
      ? rows
      : rows.filter((r) =>
          (r.clubId != null && scope!.clubIds.includes(r.clubId)) ||
          (r.majorCode != null && scope!.majors.includes(r.majorCode))
        );

    if (type === "club") return scoped.filter((r) => r.clubId != null);
    if (type === "major") return scoped.filter((r) => r.majorCode != null);
    return scoped;
  }

  /** Is this clubId one the given president may act on? Never trust a client-sent clubId. */
  static async isClubInScope(userId: string, roles: string[], clubId: string): Promise<boolean> {
    const clubIds = await EventProposalsService.getSubmittableClubIds(userId, roles);
    return clubIds.includes(clubId);
  }

  /** Is this majorCode one the given president may act on? Never trust a client-sent majorCode. */
  static async isMajorInScope(userId: string, roles: string[], majorCode: string): Promise<boolean> {
    const majors = await EventProposalsService.getSubmittableMajors(userId, roles);
    return majors.includes(majorCode);
  }

  static async getClub(clubId: string) {
    return db.query.clubs.findFirst({ where: eq(clubs.id, clubId), columns: { id: true, name: true, isArchived: true } });
  }
}
