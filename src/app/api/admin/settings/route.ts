import { auth } from "@/auth";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Only super_admin may view/edit this — it's a real privilege escalation
// (site-wide preview access), kept narrower than the general admin surface.
function canEditSettings(session: Session | null): boolean {
  if (!session?.user) return false;
  const roles = session.user.roles ?? (session.user.role ? [session.user.role] : []);
  return roles.some((r) => r === "super_admin");
}

const settingsSchema = z.object({
  previewAccessToken: z.string().trim().min(1).optional().nullable(),
});

// GET /api/admin/settings — current singleton ({ previewAccessToken }) for the editor.
export async function GET() {
  try {
    const session = await auth();
    if (!canEditSettings(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [row] = await db
      .select({ previewAccessToken: siteSettings.previewAccessToken })
      .from(siteSettings)
      .orderBy(desc(siteSettings.updatedAt))
      .limit(1);

    return NextResponse.json(row ?? { previewAccessToken: null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/admin/settings — upsert the singleton preview-access token + audit log.
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!canEditSettings(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = settingsSchema.parse(await req.json());
    const nextToken = data.previewAccessToken || null;

    await db.transaction(async (tx) => {
      // Singleton: update the most-recently-updated row, or insert the first one.
      const [existing] = await tx
        .select({ id: siteSettings.id })
        .from(siteSettings)
        .orderBy(desc(siteSettings.updatedAt))
        .limit(1);

      if (existing) {
        await tx
          .update(siteSettings)
          .set({
            previewAccessToken: nextToken,
            updatedBy: session!.user!.id!,
            updatedAt: new Date(),
          })
          .where(eq(siteSettings.id, existing.id));
      } else {
        await tx.insert(siteSettings).values({
          previewAccessToken: nextToken,
          updatedBy: session!.user!.id!,
        });
      }

      await AuditService.logActionInternal(tx, {
        actorId: session!.user!.id!,
        action: nextToken
          ? "Set/rotated site-wide preview access token"
          : "Cleared site-wide preview access token",
        ipAddress: getClientIp(req),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
