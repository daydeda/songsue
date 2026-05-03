import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { accounts, sessions, users, verificationTokens } from "@/db/schema"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    // FE-01: Restrict login to @cmu.ac.th email domain only
    async signIn({ user }) {
      const email = user.email ?? "";
      // Restriction disabled temporarily by user request
      /*
      if (!email.endsWith("@cmu.ac.th")) {
        return false;
      }
      */
      return true;
    },

    async session({ session, user }) {
      session.user.id = user.id;

      // Fetch custom DB fields to include in the session token
      const dbUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, user.id),
        columns: { role: true, profileCompleted: true, houseId: true },
      });

      if (dbUser) {
        (session.user as any).role = dbUser.role ?? "student";
        (session.user as any).profileCompleted = dbUser.profileCompleted ?? false;
        (session.user as any).houseId = dbUser.houseId ?? null;
      }

      return session;
    },
  },
  pages: {
    // Use our own sign-in page at root
    signIn: "/",
    error: "/",
  },
})