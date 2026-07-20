import { auth } from "@/auth";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { desc, eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { effectiveRoles } from "@/lib/admin-access";
import { resolveFacultyViewScope } from "@/lib/faculty-scope";
import { DEFAULT_FACULTY, isFacultyId, type FacultyId } from "@/lib/faculties";

export const dynamic = "force-dynamic";

// Only super_admin and admin may view/edit announcements — registration and
// organizer can enter /admin but are NOT allowed to touch it. We check the
// full roles array (a user can hold several roles), not just the primary role.
function hasAnnouncementRole(roles: string[]): boolean {
  return roles.some((r) => r === "super_admin" || r === "admin");
}

const announcementSchema = z.object({
  body: z.string().min(1).max(5000),
  enabled: z.boolean(),
  // Only meaningful for a super_admin (global scope) picking which faculty's
  // announcement to save — a faculty-scoped admin's target is always forced
  // to their own faculty server-side, ignoring this field, so one admin can
  // never edit another faculty's banner via a hand-crafted request body.
  faculty: z.string().optional(),
});

// Resolves which faculty's announcement this request targets. A faculty-scoped
// admin (non-super_admin) is always forced to their own faculty (see
// src/lib/faculty-scope.ts); only super_admin may pick via requestedFaculty.
// Returns null if the viewer isn't allowed to touch any faculty's announcement
// (unassigned staff account, or an invalid faculty requested by a super_admin).
function resolveTargetFaculty(
  roles: string[],
  rawFaculty: unknown,
  requestedFaculty: string | null,
): FacultyId | null {
  const scope = resolveFacultyViewScope(roles, rawFaculty);
  if (scope.global) {
    if (requestedFaculty == null) return DEFAULT_FACULTY;
    return isFacultyId(requestedFaculty) ? requestedFaculty : null;
  }
  return scope.faculty;
}

// GET /api/admin/announcement?faculty=CAMT — current announcement for the
// target faculty ({ faculty, body, enabled }) for the editor. `faculty` query
// param is only honored for super_admin; a scoped admin's own faculty always
// wins (see resolveTargetFaculty).
export async function GET(req: Request) {
  try {
    const session = await auth();
    const roles = session?.user
      ? effectiveRoles(session.user.role, session.user.roles)
      : [];
    if (!session?.user || !hasAnnouncementRole(roles)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestedFaculty = new URL(req.url).searchParams.get("faculty");
    const faculty = resolveTargetFaculty(roles, session.user.faculty, requestedFaculty);
    if (!faculty) {
      return NextResponse.json(
        { error: "No faculty assigned to your account yet, or invalid faculty requested." },
        { status: 403 },
      );
    }

    const [row] = await db
      .select({ body: announcements.body, enabled: announcements.enabled })
      .from(announcements)
      .where(eq(announcements.faculty, faculty))
      .orderBy(desc(announcements.updatedAt))
      .limit(1);

    return NextResponse.json({ faculty, body: row?.body ?? "", enabled: row?.enabled ?? true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/admin/announcement — upsert the target faculty's announcement + audit log.
export async function PUT(req: Request) {
  try {
    const session = await auth();
    const roles = session?.user
      ? effectiveRoles(session.user.role, session.user.roles)
      : [];
    if (!session?.user || !hasAnnouncementRole(roles)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = announcementSchema.parse(await req.json());
    const faculty = resolveTargetFaculty(roles, session.user.faculty, data.faculty ?? null);
    if (!faculty) {
      return NextResponse.json(
        { error: "No faculty assigned to your account yet, or invalid faculty requested." },
        { status: 403 },
      );
    }

    await db.transaction(async (tx) => {
      // Singleton-per-faculty: update that faculty's most-recently-updated
      // row, or insert its first one.
      const [existing] = await tx
        .select({ id: announcements.id })
        .from(announcements)
        .where(eq(announcements.faculty, faculty))
        .orderBy(desc(announcements.updatedAt))
        .limit(1);

      if (existing) {
        await tx
          .update(announcements)
          .set({
            body: data.body,
            enabled: data.enabled,
            updatedBy: session!.user!.id!,
            updatedAt: new Date(),
          })
          .where(and(eq(announcements.id, existing.id), eq(announcements.faculty, faculty)));
      } else {
        await tx.insert(announcements).values({
          body: data.body,
          enabled: data.enabled,
          faculty,
          updatedBy: session!.user!.id!,
        });
      }

      await AuditService.logActionInternal(tx, {
        actorId: session!.user!.id!,
        action: `Updated dashboard announcement for faculty ${faculty} (enabled: ${data.enabled})`,
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
