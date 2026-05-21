import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      profileCompleted: boolean;
      houseId: string | null;
      imageTransform: { scale: number; x: number; y: number } | null;
      qrToken: string | null;
      studentId: string | null;
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    id: string;
    role: string;
    profileCompleted: boolean;
    houseId: string | null;
    imageTransform: { scale: number; x: number; y: number } | null;
    qrToken: string | null;
    studentId: string | null;
  }
}
