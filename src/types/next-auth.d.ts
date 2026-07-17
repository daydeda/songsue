import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      roles: string[];
      profileCompleted: boolean;
      houseId: string | null;
      imageTransform: { scale: number; x: number; y: number } | null;
      qrToken: string | null;
      studentId: string | null;
      // SMO/club/major title (src/lib/positions.ts) — distinct from role/roles.
      // Not read for access control anywhere yet except the position-based
      // registration scoping in EventScopeService/admin-access.ts.
      position: string | null;
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string;
    role: string;
    roles: string[];
    profileCompleted: boolean;
    houseId: string | null;
    imageTransform: { scale: number; x: number; y: number } | null;
    qrToken: string | null;
    studentId: string | null;
    position: string | null;
  }
}
