import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { LanguageProvider } from "@/lib/LanguageContext";
import { AdminLayoutWrapper } from "@/components/admin/AdminLayoutWrapper";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) {
    redirect("/dashboard");
  }

  // "smo" is scanner-only: it can enter the admin area, but AdminNav shows just the
  // Scanner and the sensitive APIs (students, audit-logs, dashboard, etc.) still reject it.
  const allowedRoles = ["super_admin", "admin", "registration", "organizer", "smo"];
  // NB: an empty `roles` array is truthy, so `roles || [role]` would wrongly yield []
  // and lock out a user whose role lives only on the singular `role` column. Mirror
  // getPrimaryRole(): only use `roles` when it's actually populated, else fall back to `role`.
  const roles = session.user.roles;
  const userRoles = roles && roles.length > 0
    ? roles
    : (session.user.role ? [session.user.role] : ["student"]);
  const hasAccess = userRoles.some(r => allowedRoles.includes(r));
  if (!hasAccess) {
    redirect("/dashboard");
  }

  return (
    <AdminLayoutWrapper user={session.user}>
      {children}
    </AdminLayoutWrapper>
  );
}