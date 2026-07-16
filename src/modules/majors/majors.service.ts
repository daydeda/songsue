import { db } from "@/db";
import { users } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export class MajorsService {
  /**
   * Lists the students belonging to a major (name, studentId) — the major
   * analogue of ClubsService.getClubMembers. Majors have no roster table like
   * club_members; "membership" is just users.major, so this doubles as both
   * the Event Staff picker's source and the server-side re-verification of a
   * proposal's suggested staffUserIds.
   */
  static async getMajorMembers(majorCode: string) {
    return db
      .select({ id: users.id, name: users.name, studentId: users.studentId })
      .from(users)
      .where(eq(users.major, majorCode))
      .orderBy(asc(users.name));
  }
}
