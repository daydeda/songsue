import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { accounts, sessions, users, verificationTokens } from "@/db/schema"
import { eq } from "drizzle-orm"

const SUPER_ADMIN_EMAILS = ["daydedaa@gmail.com"];
const ROLE_PRIORITY = ["super_admin", "admin", "registration", "organizer", "smo", "anusmo", "staff", "professor", "officer", "student"];
const DB_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function getPrimaryRole(roles: string[] | null | undefined, fallbackRole: string | null | undefined): string {
  const list = roles && Array.isArray(roles) && roles.length > 0 ? roles : (fallbackRole ? [fallbackRole] : ["student"]);
  const primary = ROLE_PRIORITY.find(r => list.includes(r));
  return primary || list[0] || "student";
}

/** Fetch all user fields needed for the session from DB */
async function fetchUserDataFromDb(userId: string) {
  const dbUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: {
      name: true,
      image: true,
      role: true,
      roles: true,
      email: true,
      profileCompleted: true,
      houseId: true,
      imageTransform: true,
      qrToken: true,
      studentId: true,
    },
  });
  return dbUser ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // FE-01: Restrict login to @cmu.ac.th email domain only
    async signIn({ user }) {
      const email = user.email ?? "";

      // Auto-promote official emails to super_admin (FE-04)
      if (SUPER_ADMIN_EMAILS.includes(email.toLowerCase())) {
        await db.update(users)
          .set({ role: "super_admin", roles: ["super_admin"] })
          .where(eq(users.email, email));
      }

      // Ensure every user has a qrToken (FE-13)
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
        columns: { qrToken: true, id: true }
      });

      if (existingUser && !existingUser.qrToken) {
        await db.update(users)
          .set({ qrToken: crypto.randomUUID() })
          .where(eq(users.id, existingUser.id));
      }

      return true;
    },

    async jwt({ token, user, trigger }) {
      // On sign-in: hydrate the token with all user data from DB
      if (user) {
        token.id = user.id;

        const dbUser = await fetchUserDataFromDb(user.id as string);
        if (dbUser) {
          // Generate qrToken if missing (FE-13)
          let qrToken = dbUser.qrToken;
          if (!qrToken) {
            qrToken = crypto.randomUUID();
            await db.update(users).set({ qrToken }).where(eq(users.id, user.id as string));
          }

          const userRoles = (dbUser.roles as string[]) || (dbUser.role ? [dbUser.role] : ["student"]);

          token.name = dbUser.name;
          token.image = dbUser.image;
          token.email = dbUser.email;
          token.role = getPrimaryRole(userRoles, dbUser.role);
          token.roles = userRoles;
          token.profileCompleted = dbUser.profileCompleted ?? false;
          token.houseId = dbUser.houseId ?? null;
          token.imageTransform = dbUser.imageTransform ?? null;
          token.qrToken = qrToken;
          token.studentId = dbUser.studentId ?? null;

          // Super admin override
          const currentEmail = (dbUser.email || "").toLowerCase();
          if (SUPER_ADMIN_EMAILS.includes(currentEmail)) {
            token.role = "super_admin";
            token.roles = ["super_admin"];
          }
        }

        token.lastDbRefresh = Date.now();
      }

      // On explicit update trigger: force a DB refresh
      if (trigger === "update") {
        token.updateTime = Date.now();
        const userId = (token.id || token.sub) as string;
        if (userId) {
          const dbUser = await fetchUserDataFromDb(userId);
          if (dbUser) {
            let qrToken = dbUser.qrToken;
            if (!qrToken) {
              qrToken = crypto.randomUUID();
              await db.update(users).set({ qrToken }).where(eq(users.id, userId));
            }

            const userRoles = (dbUser.roles as string[]) || (dbUser.role ? [dbUser.role] : ["student"]);

            token.name = dbUser.name;
            token.image = dbUser.image;
            token.email = dbUser.email;
            token.role = getPrimaryRole(userRoles, dbUser.role);
            token.roles = userRoles;
            token.profileCompleted = dbUser.profileCompleted ?? false;
            token.houseId = dbUser.houseId ?? null;
            token.imageTransform = dbUser.imageTransform ?? null;
            token.qrToken = qrToken;
            token.studentId = dbUser.studentId ?? null;

            const currentEmail = (dbUser.email || "").toLowerCase();
            if (SUPER_ADMIN_EMAILS.includes(currentEmail)) {
              token.role = "super_admin";
              token.roles = ["super_admin"];
            }
          }

          token.lastDbRefresh = Date.now();
        }
      }

      return token;
    },

    async session({ session, token }) {
      const userId = (token.id || token.sub) as string;
      if (userId) {
        session.user.id = userId;
      } else {
        return session; // No user ID, can't populate session
      }

      // Check if we need a DB refresh (every 5 minutes)
      const lastRefresh = (token.lastDbRefresh as number) || 0;
      const needsRefresh = Date.now() - lastRefresh > DB_REFRESH_INTERVAL_MS;

      if (needsRefresh) {
        // Periodic refresh: re-fetch from DB to catch role changes, profile updates, etc.
        const dbUser = await fetchUserDataFromDb(userId);
        if (dbUser) {
          let qrToken = dbUser.qrToken;
          if (!qrToken) {
            qrToken = crypto.randomUUID();
            await db.update(users).set({ qrToken }).where(eq(users.id, userId));
          }

          const userRoles = (dbUser.roles as string[]) || (dbUser.role ? [dbUser.role] : ["student"]);

          session.user.name = dbUser.name ?? session.user.name;
          session.user.image = dbUser.image ?? session.user.image;
          session.user.email = dbUser.email;
          session.user.roles = userRoles;
          session.user.role = getPrimaryRole(userRoles, dbUser.role);
          session.user.profileCompleted = dbUser.profileCompleted ?? false;
          session.user.houseId = dbUser.houseId ?? null;
          session.user.imageTransform = (dbUser.imageTransform as { scale: number; x: number; y: number } | null) ?? null;
          session.user.qrToken = qrToken;
          session.user.studentId = dbUser.studentId ?? null;

          // Super admin override
          const currentEmail = (dbUser.email || "").toLowerCase();
          if (SUPER_ADMIN_EMAILS.includes(currentEmail)) {
            session.user.role = "super_admin";
            session.user.roles = ["super_admin"];
          }

          // Update token's lastDbRefresh (will be persisted on next JWT encode)
          token.lastDbRefresh = Date.now();
          // Also sync token fields so they stay fresh
          token.name = session.user.name;
          token.image = session.user.image;
          token.email = session.user.email;
          token.role = session.user.role;
          token.roles = session.user.roles;
          token.profileCompleted = session.user.profileCompleted;
          token.houseId = session.user.houseId;
          token.imageTransform = session.user.imageTransform;
          token.qrToken = session.user.qrToken;
          token.studentId = session.user.studentId;
        }

        return session;
      }

      // Fast path: read from JWT token (no DB query)
      session.user.name = (token.name as string) ?? session.user.name;
      session.user.image = (token.image as string) ?? session.user.image;
      session.user.email = (token.email as string) ?? session.user.email;
      session.user.roles = (token.roles as string[]) ?? ["student"];
      session.user.role = (token.role as string) ?? "student";
      session.user.profileCompleted = (token.profileCompleted as boolean) ?? false;
      session.user.houseId = (token.houseId as string) ?? null;
      session.user.imageTransform = (token.imageTransform as { scale: number; x: number; y: number } | null) ?? null;
      session.user.qrToken = (token.qrToken as string) ?? null;
      session.user.studentId = (token.studentId as string) ?? null;

      // Force super_admin role for the official emails - CASE INSENSITIVE (FE-04)
      const currentEmail = (session.user?.email || "").toLowerCase();
      if (SUPER_ADMIN_EMAILS.includes(currentEmail)) {
        session.user.role = "super_admin";
        session.user.roles = ["super_admin"];
      }

      return session;
    },
  },
  pages: {
    // Use our own sign-in page at /login
    signIn: "/login",
    error: "/login",
  },
})