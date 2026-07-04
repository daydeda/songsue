import { db } from "@/db";
import { clubMembers, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type PresidentScope = {
  clubIds: string[];
  majors: string[];
};

type ScopedEvent = {
  ownerClubIds?: string[] | null;
  ownerMajors?: string[] | null;
};

export class EventScopeService {
  /**
   * Resolves a president's identity scope: which clubs they preside over (from
   * club_members) and which major they represent (their own users.major — majors
   * are a fixed set, so no separate assignment exists). Roles outside
   * club_president/major_president resolve to an empty scope.
   */
  static async getPresidentScope(userId: string, roles: string[]): Promise<PresidentScope> {
    const clubIds: string[] = [];
    const majors: string[] = [];

    if (roles.includes("club_president")) {
      const memberships = await db.query.clubMembers.findMany({
        where: and(eq(clubMembers.userId, userId), eq(clubMembers.role, "president")),
        columns: { clubId: true },
      });
      clubIds.push(...memberships.map((m) => m.clubId));
    }

    if (roles.includes("major_president")) {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { major: true },
      });
      if (user?.major) majors.push(user.major);
    }

    return { clubIds, majors };
  }

  /**
   * Single-event gate for attendance/export/report/scan/scan-count: does this
   * president's scope own the event? Requires a NON-EMPTY matching owner list —
   * an event with managedByRoles including a president role but no ownerClubIds/
   * ownerMajors assigned yet is "unassigned" and stays hidden from every president
   * until staff assigns an owner. Staff/admin bypass happens at the call site,
   * before this is ever invoked.
   */
  static isEventManagedByScope(event: ScopedEvent, scope: PresidentScope): boolean {
    const clubMatch = (event.ownerClubIds ?? []).some((id) => scope.clubIds.includes(id));
    const majorMatch = (event.ownerMajors ?? []).some((m) => scope.majors.includes(m));
    return clubMatch || majorMatch;
  }

  /** List-filter variant of isEventManagedByScope, for the events list route. */
  static filterEventsByScope<T extends ScopedEvent>(events: T[], scope: PresidentScope): T[] {
    return events.filter((event) => EventScopeService.isEventManagedByScope(event, scope));
  }
}
