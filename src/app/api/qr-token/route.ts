import { auth } from "@/auth";
import { signQrToken } from "@/lib/qr-token";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = signQrToken(session.user.id);
  return NextResponse.json({ token }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
