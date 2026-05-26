import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export class UsersService {
  /**
   * Resolves a student profile by their unique QR token or their direct user ID (fallback)
   * Includes relation to their assigned house.
   */
  static async resolveStudentByToken(token: string) {
    return await db.query.users.findFirst({
      where: (users, { eq, or }) => or(
        eq(users.qrToken, token),
        eq(users.id, token)
      ),
      with: { house: true },
    });
  }

  /**
   * Validates if a user has admin permissions
   */
  static async isAdmin(userId: string): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        role: true,
      },
    });
    return user?.role === "admin";
  }

  /**
   * General lookup of a user by ID
   */
  static async getUserById(userId: string) {
    return await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
  }
}
