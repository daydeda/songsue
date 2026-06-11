import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "@/db"
import { accounts, sessions, users, verificationTokens } from "@/db/schema"
import { eq } from "drizzle-orm"

const SUPER_ADMIN_EMAILS = ["daydedaa@gmail.com"];
const ROLE_PRIORITY = ["super_admin", "admin", "registration", "organizer", "smo", "anusmo", "staff", "professor", "officer", "student"];
// How often the session is re-hydrated from the DB to pick up role/profile/house
// changes made elsewhere (e.g. an admin assigning a role). This refresh lives in
// the `jwt` callback so the timestamp PERSISTS to the cookie — meaning it runs at
// most once per interval per user. (It used to live in the `session` callback,
// where token mutations are silently discarded, so it re-queried the DB on EVERY
// request after the first 5 min — a big standing load with hundreds of pollers.)
const DB_REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

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

type DbUser = NonNullable<Awaited<ReturnType<typeof fetchUserDataFromDb>>>;

/**
 * Copy fresh DB user fields onto the JWT token. Generates a qrToken if one is
 * missing, applies role priority, and forces super_admin for official emails.
 * Returns the (possibly newly generated) qrToken so the caller can persist it.
 */
async function applyDbUserToToken(token: Record<string, unknown>, dbUser: DbUser, userId: string) {
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Trust the host header for callback-URL construction. Required for non-Vercel
  // deploys (Docker / university server) where Auth.js can't auto-detect the host;
  // a wrong host breaks the OAuth round-trip and surfaces as an InvalidCheck/PKCE
  // failure. On Vercel this is already implied. AUTH_URL (prod) must still match
  // the live domain exactly — apex vs www — and Google's redirect URI must be
  // https://<domain>/api/auth/callback/google.
  trustHost: true,
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
        if (dbUser) await applyDbUserToToken(token, dbUser, user.id as string);
        token.lastDbRefresh = Date.now();
        return token;
      }

      const userId = (token.id || token.sub) as string;

      // On explicit update trigger (e.g. user just completed their profile): force
      // an immediate DB refresh. Persists because we're in the jwt callback.
      if (trigger === "update" && userId) {
        token.updateTime = Date.now();
        const dbUser = await fetchUserDataFromDb(userId);
        if (dbUser) await applyDbUserToToken(token, dbUser, userId);
        token.lastDbRefresh = Date.now();
        return token;
      }

      // Eager refresh while onboarding is incomplete. A brand-new user's token has
      // profileCompleted=false; after they submit the onboarding form we must NOT
      // depend on the client's update() call landing before it navigates (a race).
      // Instead, every request re-reads the DB *until* the profile is complete, so
      // the navigation to /dashboard itself picks up profileCompleted=true plus the
      // assigned house/role and persists them. Self-limiting: once the flag flips
      // true this path stops firing and we fall back to the periodic refresh below.
      const profileIncomplete = !token.profileCompleted;

      // Periodic refresh: re-hydrate from DB at most once per interval to pick up
      // role/profile/house changes made elsewhere. The new lastDbRefresh persists
      // to the cookie, so this does NOT re-query on every subsequent request.
      const lastRefresh = (token.lastDbRefresh as number) || 0;
      const periodicDue = Date.now() - lastRefresh > DB_REFRESH_INTERVAL_MS;

      if (userId && (profileIncomplete || periodicDue)) {
        const dbUser = await fetchUserDataFromDb(userId);
        if (dbUser) await applyDbUserToToken(token, dbUser, userId);
        token.lastDbRefresh = Date.now();
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

      // Pure mapping from the (already-fresh) JWT token — no DB query here. All DB
      // refresh logic lives in the jwt callback above so its writes persist.
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