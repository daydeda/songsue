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
  const allowedRoles = ["super_admin", "admin", "registration", "organizer"];
  if (!session?.user || !allowedRoles.includes(session.user.role || "")) {
    redirect("/dashboard");
  }

  return (
    <AdminLayoutWrapper user={session.user}>
      {children}
    </AdminLayoutWrapper>
  );
}