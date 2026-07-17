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

  /**
   * Resolves scope for a users.position === "registration" holder (see
   * CLAUDE.md / the registration-role-retirement plan). `position` comes from
   * the session (no extra query needed for the smo/anusmo case):
   *   - smo/anusmo + position="registration" -> global (scope.global = true).
   *   - has a club_members row (any role, 'member' or 'president') -> scoped
   *     to that/those club(s)' events only.
   *   - otherwise (plain student, identified only by users.major) -> scoped
   *     to their own major's events only.
   * Anything else (position !== "registration") resolves to an empty,
   * non-global scope — no registration-position access at all.
   */
  static async getRegistrationPositionScope(
    userId: string,
    roles: string[],
    position: string | null | undefined
  ): Promise<{ global: boolean } & PresidentScope> {
    if (position !== "registration") return { global: false, clubIds: [], majors: [] };

    if (roles.includes("smo") || roles.includes("anusmo")) {
      return { global: true, clubIds: [], majors: [] };
    }

    const memberships = await db.query.clubMembers.findMany({
      where: eq(clubMembers.userId, userId),
      columns: { clubId: true },
    });
    if (memberships.length > 0) {
      return { global: false, clubIds: memberships.map((m) => m.clubId), majors: [] };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { major: true },
    });
    return { global: false, clubIds: [], majors: user?.major ? [user.major] : [] };
  }

  /**
   * Combined access resolver for event-scoped routes, replacing the
   * duplicated "isUnscopedStaff / getPresidentScope" boilerplate at each call
   * site. `isUnscopedStaff` and `hasPresidentTag` stay each route's own
   * existing role-array checks (still include "registration" in Phase 1, so
   * this is a strict superset of today's behavior — nothing regresses).
   */
  static async resolveEventAccess(params: {
    userId: string;
    roles: string[];
    position: string | null | undefined;
    isUnscopedStaff: boolean;
    hasPresidentTag: boolean;
  }): Promise<
    | { allowed: false }
    | { allowed: true; unscoped: true }
    | { allowed: true; unscoped: false; scope: PresidentScope }
  > {
    if (params.isUnscopedStaff) return { allowed: true, unscoped: true };

    const reg = await EventScopeService.getRegistrationPositionScope(
      params.userId,
      params.roles,
      params.position
    );
    if (reg.global) return { allowed: true, unscoped: true };

    const pres = params.hasPresidentTag
      ? await EventScopeService.getPresidentScope(params.userId, params.roles)
      : { clubIds: [], majors: [] };

    if (!params.hasPresidentTag && params.position !== "registration") {
      return { allowed: false };
    }

    return {
      allowed: true,
      unscoped: false,
      scope: {
        clubIds: [...pres.clubIds, ...reg.clubIds],
        majors: [...pres.majors, ...reg.majors],
      },
    };
  }
}
