import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      roles: string[];
      profileCompleted: boolean;
      // Permanent site-wide early-registration grant redeemed via the /preview
      // link (users.previewAccess) — see the register route's bypass. Session
      // field only, so it can drive client-side UI (e.g. not greying out a
      // not-yet-open event's register button); the server route re-reads the
      // DB column directly and never trusts this for the actual gate.
      previewAccess: boolean;
      houseId: string | null;
      faculty: string | null;
      imageTransform: { scale: number; x: number; y: number } | null;
      qrToken: string | null;
      studentId: string | null;
      // Scoped staff titles (src/lib/positions.ts) — distinct from role/roles.
      // Replace the old single global `position` field: club titles live on
      // club_members.position (per club, not on the session), majorPosition/
      // smoPosition/anusmoPosition are scoped to the user's one major and to
      // holding the smo/anusmo role respectively (a user can hold both roles
      // at once with different titles in each). hasClubPosition/
      // hasStaffPosition are precomputed booleans (see src/auth.ts) so the
      // edge proxy never needs a DB round trip to answer "does this user hold
      // ANY / a club-scoped staff title" — used for admin-entry gating in
      // admin-access.ts. smoPosition/anusmoPosition feed
      // isGlobalRegistrationPosition there too.
      majorPosition: string | null;
      smoPosition: string | null;
      anusmoPosition: string | null;
      hasClubPosition: boolean;
      hasStaffPosition: boolean;
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string;
    role: string;
    roles: string[];
    profileCompleted: boolean;
    previewAccess: boolean;
    houseId: string | null;
    faculty: string | null;
    imageTransform: { scale: number; x: number; y: number } | null;
    qrToken: string | null;
    studentId: string | null;
    majorPosition: string | null;
    smoPosition: string | null;
    anusmoPosition: string | null;
    hasClubPosition: boolean;
    hasStaffPosition: boolean;
  }
}
