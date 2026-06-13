import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isShopAdmin } from "@/lib/shop-auth";
import AdminShopClient from "./AdminShopClient";

export const dynamic = "force-dynamic";

// Defense-in-depth on top of the API gate: only super_admin/admin may manage the
// shop (registration/organizer can enter /admin but not touch money/merch).
export default async function AdminShopPage() {
  const session = await auth();
  if (!isShopAdmin(session)) {
    redirect("/admin/dashboard");
  }
  return <AdminShopClient />;
}
