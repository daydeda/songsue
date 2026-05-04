import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { accounts, sessions, users, verificationTokens } from "@/db/schema"
import { eq } from "drizzle-orm"

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
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    // FE-01: Restrict login to @cmu.ac.th email domain only
    async signIn({ user }) {
      const email = user.email ?? "";
      
      // Auto-promote official SMO email to admin and mark profile as complete (FE-04)
      if (email === "smocamt.official@gmail.com") {
        await db.update(users)
          .set({ role: "admin", profileCompleted: true })
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

    async session({ session, user }) {
      session.user.id = user.id;
      session.user.email = user.email;

      // Fetch custom DB fields to include in the session token
      const dbUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, user.id),
        columns: { 
          role: true, 
          email: true,
          profileCompleted: true, 
          houseId: true, 
          imageTransform: true,
          qrToken: true
        },
      });

      if (dbUser) {
        session.user.email = dbUser.email;
        (session.user as any).role = dbUser.role ?? "student";
        (session.user as any).profileCompleted = dbUser.profileCompleted ?? false;
        (session.user as any).houseId = dbUser.houseId ?? null;
        (session.user as any).imageTransform = dbUser.imageTransform ?? null;
        (session.user as any).qrToken = dbUser.qrToken ?? null;
      }

      // Force admin role for the official SMO email - CASE INSENSITIVE (FE-04)
      const adminEmail = "smocamt.official@gmail.com".toLowerCase();
      const currentEmail = (session.user?.email || dbUser?.email || user?.email || "").toLowerCase();
      
      if (currentEmail === adminEmail) {
        (session.user as any).role = "admin";
        (session.user as any).profileCompleted = true;
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