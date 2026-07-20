import { auth } from "@/auth";
import { db } from "@/db";
import { siteSettings, users } from "@/db/schema";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const activateSchema = z.object({
  token: z.string().min(1),
});

// POST /api/preview/activate — redeem the site-wide preview-access link
// (see users.previewAccess and site_settings.previewAccessToken). Any
// authenticated user can call this; the secret token is the gate, not role.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid or expired access link" }, { status: 400 });
    }

    const [current] = await db
      .select({ previewAccessToken: siteSettings.previewAccessToken })
      .from(siteSettings)
      .orderBy(desc(siteSettings.updatedAt))
      .limit(1);

    if (!current?.previewAccessToken || parsed.data.token !== current.previewAccessToken) {
      return NextResponse.json({ error: "Invalid or expired access link" }, { status: 403 });
    }

    const userId = session.user.id;
    const existing = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { previewAccess: true },
    });

    // Idempotent: redeeming an already-active link is a no-op success, not an
    // error — no need to re-write the row or add a duplicate audit entry.
    if (existing?.previewAccess) {
      return NextResponse.json({ success: true });
    }

    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({ previewAccess: true, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await AuditService.logActionInternal(tx, {
        actorId: userId,
        action: "Activated site-wide preview access via link",
        ipAddress: getClientIp(req),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
