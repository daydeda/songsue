import { auth } from "@/auth";
import { AuditService } from "@/modules/audit/audit.service";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || !["super_admin", "admin"].includes(session.user.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await AuditService.verifyChainIntegrity();
  return NextResponse.json(result);
}
