import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { effectiveRoles } from "@/lib/admin-access";
import { RESET_STRIKES_ROLES } from "@/lib/strikes";
import { AppealsClient } from "./AppealsClient";

export const dynamic = "force-dynamic";

// The /admin layout already gates entry to super_admin/admin/registration/organizer.
// Resolving an appeal resets a student's strikes, so this page is further
// restricted to the same roles as RESET_STRIKES_ROLES (src/lib/strikes.ts) and the
// PATCH /api/admin/appeals/[id] role check — reused here (not re-hardcoded) so the
// redirect can't drift from the API's actual gate.
export default async function AdminAppealsPage() {
  const session = await auth();
  const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
  const canReview = myRoles.some((r) => (RESET_STRIKES_ROLES as readonly string[]).includes(r));
  if (!canReview) {
    redirect("/admin/dashboard");
  }

  return <AppealsClient />;
}
