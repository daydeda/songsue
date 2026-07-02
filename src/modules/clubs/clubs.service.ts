import { db } from "@/db";
import { clubs, clubMembers, events, users } from "@/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

// Mirrors AuditService's DBTransaction type (src/modules/audit/audit.service.ts) so
// callers that need setUserClubPresidencies to be atomic with their own writes (e.g.
// the users PATCH route's audit log) can pass their existing `tx` through instead of
// letting this open its own separate transaction.
type DBTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class ClubsService {
  /**
   * Lists clubs (optionally including archived ones), each annotated with its
   * total member count and president count via a single grouped aggregate —
   * avoids an N+1 count-per-club query.
   */
  static async listClubs(includeArchived: boolean) {
    const rows = await db
      .select({
        id: clubs.id,
        name: clubs.name,
        isArchived: clubs.isArchived,
        createdAt: clubs.createdAt,
        memberCount: sql<number>`count(${clubMembers.id})::int`,
        presidentCount: sql<number>`count(${clubMembers.id}) filter (where ${clubMembers.role} = 'president')::int`,
      })
      .from(clubs)
      .leftJoin(clubMembers, eq(clubMembers.clubId, clubs.id))
      .where(includeArchived ? undefined : eq(clubs.isArchived, false))
      .groupBy(clubs.id)
      .orderBy(asc(clubs.name));

    return rows;
  }

  /**
   * Creates a new club. isArchived defaults false (schema default).
   */
  static async createClub(name: string) {
    const [created] = await db.insert(clubs).values({ name }).returning();
    return created;
  }

  /**
   * Renames a club.
   */
  static async renameClub(id: string, name: string) {
    const [updated] = await db
      .update(clubs)
      .set({ name, updatedAt: new Date() })
      .where(eq(clubs.id, id))
      .returning();
    return updated;
  }

  /**
   * Archives or unarchives a club. Clubs are never hard-deleted so events they
   * already own and their membership history survive.
   */
  static async setArchived(id: string, isArchived: boolean) {
    const [updated] = await db
      .update(clubs)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(clubs.id, id))
      .returning();
    return updated;
  }

  /**
   * Permanently deletes a club. club_members rows cascade automatically (FK
   * ON DELETE CASCADE), but events.ownerClubIds is a jsonb array with no FK —
   * Postgres can't cascade into it, so any event still listing this club as an
   * owner is patched to drop the id first. Otherwise a deleted club's id would
   * silently linger in an event's ownerClubIds, which is harmless for scoping
   * (it just never matches anyone) but confusing to a future reader/audit.
   * Returns the deleted club row, or undefined if no club had that id.
   */
  static async deleteClub(id: string) {
    return await db.transaction(async (tx) => {
      const affected = await tx
        .select({ id: events.id, ownerClubIds: events.ownerClubIds })
        .from(events)
        .where(sql`${events.ownerClubIds} @> ${JSON.stringify([id])}::jsonb`);

      for (const ev of affected) {
        const next = (ev.ownerClubIds ?? []).filter((clubId) => clubId !== id);
        await tx
          .update(events)
          .set({ ownerClubIds: next.length > 0 ? next : null })
          .where(eq(events.id, ev.id));
      }

      const [deleted] = await tx.delete(clubs).where(eq(clubs.id, id)).returning();
      return deleted;
    });
  }

  /**
   * Lists a club's members with role, joined with the user's display name and
   * student id. Groundwork for a future per-club roster UI — not surfaced yet.
   */
  static async getClubMembers(clubId: string) {
    const rows = await db
      .select({
        id: clubMembers.id,
        userId: clubMembers.userId,
        role: clubMembers.role,
        userName: users.name,
        studentId: users.studentId,
      })
      .from(clubMembers)
      .innerJoin(users, eq(users.id, clubMembers.userId))
      .where(eq(clubMembers.clubId, clubId))
      .orderBy(asc(users.name));

    return rows;
  }

  /**
   * Adds a user to a club as a plain 'member' — the rank-and-file counterpart to
   * the 'president' role. Idempotent: re-adding someone who's already a member
   * OR already a president is a no-op (never downgrades an existing president —
   * that role is only ever granted/revoked via setUserClubPresidencies, which
   * stays in sync with the user's club_president system role tag; this method
   * intentionally has no way to set role='president', to avoid creating a
   * club_members row that claims presidency without the matching system role).
   */
  static async addClubMember(clubId: string, userId: string) {
    const [inserted] = await db
      .insert(clubMembers)
      .values({ clubId, userId, role: "member" })
      .onConflictDoNothing({ target: [clubMembers.clubId, clubMembers.userId] })
      .returning();
    if (inserted) return inserted;

    const [existing] = await db
      .select()
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
    return existing;
  }

  /**
   * Upserts a 'president' club_members row for (clubId, userId). Idempotent —
   * re-adding an existing president is a no-op besides confirming the role.
   */
  static async addClubPresident(clubId: string, userId: string) {
    const [row] = await db
      .insert(clubMembers)
      .values({ clubId, userId, role: "president" })
      .onConflictDoUpdate({
        target: [clubMembers.clubId, clubMembers.userId],
        set: { role: "president" },
      })
      .returning();
    return row;
  }

  /**
   * Club IDs this user currently presides over (role='president'). Used to
   * pre-check the club picker when a staff member opens a user's role editor.
   */
  static async getPresidentClubIds(userId: string): Promise<string[]> {
    const rows = await db
      .select({ clubId: clubMembers.clubId })
      .from(clubMembers)
      .where(and(eq(clubMembers.userId, userId), eq(clubMembers.role, "president")));
    return rows.map((r) => r.clubId);
  }

  /**
   * Removes a (clubId, userId) membership row entirely, regardless of role.
   */
  static async removeClubMember(clubId: string, userId: string) {
    await db
      .delete(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
  }

  /**
   * Given a user and the FULL desired list of clubs they should preside over,
   * diffs against their current role='president' rows and upserts/deletes to
   * match exactly. Never touches role='member' rows for this user (reserved
   * for a future roster feature).
   *
   * Accepts an optional caller-supplied `tx` so this can run INSIDE an already-
   * open transaction (e.g. the users PATCH route's own db.transaction, whose
   * audit log entry describes this exact change) — without it, a crash between
   * the two writes would leave a committed audit entry claiming a presidency
   * change that never actually landed. When no `tx` is given, opens its own
   * transaction so a direct caller still gets atomicity.
   */
  static async setUserClubPresidencies(userId: string, clubIds: string[], tx?: DBTransaction) {
    if (tx) {
      await ClubsService.applyClubPresidencies(tx, userId, clubIds);
      return;
    }
    await db.transaction(async (innerTx) => {
      await ClubsService.applyClubPresidencies(innerTx, userId, clubIds);
    });
  }

  private static async applyClubPresidencies(tx: DBTransaction, userId: string, clubIds: string[]) {
    const current = await tx
      .select({ clubId: clubMembers.clubId })
      .from(clubMembers)
      .where(and(eq(clubMembers.userId, userId), eq(clubMembers.role, "president")));

    const currentIds = new Set(current.map((c) => c.clubId));
    const desiredIds = new Set(clubIds);

    const toAdd = clubIds.filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));

    for (const clubId of toAdd) {
      await tx
        .insert(clubMembers)
        .values({ clubId, userId, role: "president" })
        .onConflictDoUpdate({
          target: [clubMembers.clubId, clubMembers.userId],
          set: { role: "president" },
        });
    }

    if (toRemove.length > 0) {
      await tx
        .delete(clubMembers)
        .where(
          and(
            eq(clubMembers.userId, userId),
            eq(clubMembers.role, "president"),
            inArray(clubMembers.clubId, toRemove),
          ),
        );
    }
  }
}
