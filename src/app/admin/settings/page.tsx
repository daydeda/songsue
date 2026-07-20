import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SettingsEditor } from "./SettingsEditor";

export const dynamic = "force-dynamic";

// The /admin layout already gates entry to super_admin/admin/registration/organizer.
// This page is further restricted to super_admin + admin only (defense in depth on
// top of the GET/PUT /api/admin/settings role check) — the preview-access token is
// a real privilege-escalation secret, kept narrower than the general admin surface.
export default async function AdminSettingsPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? (session?.user?.role ? [session.user.role] : []);
  const canEdit = roles.some((r) => r === "super_admin" || r === "admin");
  if (!canEdit) {
    redirect("/admin/dashboard");
  }

  return <SettingsEditor />;
}
