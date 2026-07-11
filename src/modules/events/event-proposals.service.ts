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
   * Lists proposals for a viewer: staff (isStaff=true) see everything,
   * optionally filtered by status; a club_president sees only proposals for
   * clubs they preside over. Never trusts a client-supplied scope — always
   * re-resolves it from the viewer's own userId/roles.
   */
  static async listForViewer(userId: string, roles: string[], isStaff: boolean, status?: string | null) {
    const clubIds = isStaff ? null : await EventProposalsService.getSubmittableClubIds(userId, roles);
    if (!isStaff && clubIds!.length === 0) return [];

    const rows = await db.query.eventProposals.findMany({
      where: status ? eq(eventProposals.status, status) : undefined,
      orderBy: [desc(eventProposals.createdAt)],
      with: {
        club: { columns: { id: true, name: true, isArchived: true } },
        proposer: { columns: { id: true, name: true, studentId: true } },
      },
    });

    // No pagination for v1 — mirrors the existing /api/admin/appeals precedent
    // of fetch-all + client-side paging at this data volume.
    return isStaff ? rows : rows.filter((r) => clubIds!.includes(r.clubId));
  }

  /** Is this clubId one the given president may act on? Never trust a client-sent clubId. */
  static async isClubInScope(userId: string, roles: string[], clubId: string): Promise<boolean> {
    const clubIds = await EventProposalsService.getSubmittableClubIds(userId, roles);
    return clubIds.includes(clubId);
  }

  static async getClub(clubId: string) {
    return db.query.clubs.findFirst({ where: eq(clubs.id, clubId), columns: { id: true, name: true, isArchived: true } });
  }
}
