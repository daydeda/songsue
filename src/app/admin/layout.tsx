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

  const allowedRoles = ["super_admin", "admin", "registration", "organizer"];
  const userRoles = session.user.roles || (session.user.role ? [session.user.role] : ["student"]);
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