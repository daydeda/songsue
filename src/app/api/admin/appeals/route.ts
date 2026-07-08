import { auth } from "@/auth";
import { db } from "@/db";
import { noShowAppeals } from "@/db/schema";
import { effectiveRoles } from "@/lib/admin-access";
import { VIEW_APPEALS_ROLES } from "@/lib/strikes";
import { EventScopeService } from "@/modules/events/event-scope.service";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/admin/appeals — list no-show appeals for staff review, most recent
// first. Gated by VIEW_APPEALS_ROLES (src/lib/strikes.ts): super_admin/admin/
// registration/smo see every appeal; club_president/major_president are scoped
// to appeals whose event they own (EventScopeService, mirroring
// api/admin/events' list scoping) — an appeal with no linked event, or one
// linked to an event they don't own, is hidden from them. Whether a viewer may
// also resolve (approve/reject) an appeal is enforced separately and more
// narrowly by PATCH /api/admin/appeals/[id] (RESOLVE_APPEALS_ROLES excludes
// smo). Each appeal is tied to one specific
// event (US-STRI-15c: per-event appeals, not a blanket account appeal) via the
// direct eventId relation — no more best-effort matching against a user's
// recent no-show attendance rows.
export async function GET(req: Request) {
  try {
    const session = await auth();
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    if (!session?.user || !myRoles.some((r) => (VIEW_APPEALS_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const appeals = await db.query.noShowAppeals.findMany({
      where: status ? eq(noShowAppeals.status, status) : undefined,
      orderBy: [desc(noShowAppeals.createdAt)],
      with: {
        user: {
          columns: { id: true, name: true, studentId: true, noShowCount: true, registrationBlocked: true },
          with: { house: { columns: { id: true, name: true, color: true } } },
        },
        event: { columns: { id: true, title: true, endTime: true, ownerClubIds: true, ownerMajors: true } },
        reviewer: {
          columns: { id: true, name: true },
        },
      },
    });

    const isUnscoped = myRoles.some((r) => ["super_admin", "admin", "registration", "smo"].includes(r));
    const presidentTags = myRoles.filter((r) => ["club_president", "major_president"].includes(r));
    const scoped =
      !isUnscoped && presidentTags.length > 0
        ? await (async () => {
            const scope = await EventScopeService.getPresidentScope(session.user!.id!, myRoles);
            return appeals.filter((a) => a.event && EventScopeService.isEventManagedByScope(a.event, scope));
          })()
        : appeals;

    // ownerClubIds/ownerMajors were only fetched for the scoping check above —
    // strip them before returning so the response shape matches what
    // AppealsClient expects.
    const response = scoped.map((a) => ({
      ...a,
      event: a.event ? { id: a.event.id, title: a.event.title, endTime: a.event.endTime } : null,
    }));

    return NextResponse.json({ appeals: response });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
