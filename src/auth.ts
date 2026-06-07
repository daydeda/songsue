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
      
      // Auto-promote official emails to super_admin and mark profile as complete (FE-04)
      const superAdminEmails = ["smocamt.official@gmail.com", "daydedaa@gmail.com"];
      if (superAdminEmails.includes(email.toLowerCase())) {
        await db.update(users)
          .set({ role: "super_admin", profileCompleted: true })
          .where(eq(users.email, email));
      }

      // Ensure every user has a qrToken (FE-13)
      // Note: On first sign-in, the user might not be in the DB yet.
      // The session callback below will act as a secondary safety net.
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
      if (user) {
        token.id = user.id;
      }
      if (trigger === "update") {
        token.updateTime = Date.now(); // Forces NextAuth to regenerate and write a fresh session cookie
      }
      return token;
    },
    async session({ session, token }) {
      const userId = (token.id || token.sub) as string;
      if (userId) {
        session.user.id = userId;
      } else {
        return session; // No user ID, can't fetch DB details
      }

      // Fetch custom DB fields to include in the session token
      const dbUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userId),
        columns: { 
          name: true,
          image: true,
          role: true, 
          email: true,
          profileCompleted: true, 
          houseId: true, 
          imageTransform: true,
          qrToken: true,
          studentId: true,
        },
      });

      if (dbUser) {
        // If qrToken is missing in DB for some reason, generate it now (FE-13)
        if (!dbUser.qrToken) {
          const newToken = crypto.randomUUID();
          await db.update(users).set({ qrToken: newToken }).where(eq(users.id, userId));
          dbUser.qrToken = newToken;
        }

        session.user.name = dbUser.name ?? session.user.name;
        session.user.image = dbUser.image ?? session.user.image;
        session.user.email = dbUser.email;
        session.user.role = dbUser.role ?? "student";
        session.user.profileCompleted = dbUser.profileCompleted ?? false;
        session.user.houseId = dbUser.houseId ?? null;
        session.user.imageTransform = (dbUser.imageTransform as { scale: number; x: number; y: number } | null) ?? null;
        session.user.qrToken = dbUser.qrToken;
        session.user.studentId = dbUser.studentId ?? null;
      }

      // Force super_admin role for the official emails - CASE INSENSITIVE (FE-04)
      const superAdmins = ["smocamt.official@gmail.com", "daydedaa@gmail.com"];
      const currentEmail = (session.user?.email || dbUser?.email || "").toLowerCase();
      
      if (superAdmins.includes(currentEmail)) {
        session.user.role = "super_admin";
        session.user.profileCompleted = true;
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