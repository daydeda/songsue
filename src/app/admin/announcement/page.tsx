import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AnnouncementEditor } from "./AnnouncementEditor";
import { effectiveRoles } from "@/lib/admin-access";
import { resolveFacultyViewScope } from "@/lib/faculty-scope";

export const dynamic = "force-dynamic";

// The /admin layout already gates entry to super_admin/admin/registration/organizer.
// This page is further restricted to super_admin + admin only (defense in depth on
// top of the PUT /api/admin/announcement role check).
export default async function AdminAnnouncementPage() {
  const session = await auth();
  const roles = session?.user
    ? effectiveRoles(session.user.role, session.user.roles)
    : [];
  const canEdit = roles.some((r) => r === "super_admin" || r === "admin");
  if (!canEdit) {
    redirect("/admin/dashboard");
  }

  // Faculty scoping (see src/lib/faculty-scope.ts): a non-super_admin admin
  // only ever edits their own faculty's announcement — the editor hides the
  // faculty tabs for them. super_admin can switch between all 4.
  const scope = resolveFacultyViewScope(roles, session!.user!.faculty);

  return <AnnouncementEditor isGlobal={scope.global} ownFaculty={scope.global ? null : scope.faculty} />;
}
