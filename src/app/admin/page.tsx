import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { adminLandingHref } from "@/lib/admin-access";

// Canonical admin entry. The "Admin Panel" links all point here so the landing
// page is decided server-side from the authoritative session role — not from a
// possibly-stale client session. SMO lands on the scanner; everyone else on the
// dashboard. (The layout above already redirects unauthenticated/disallowed users.)
export default async function AdminIndex() {
  const session = await auth();
  redirect(adminLandingHref(session?.user?.role));
}
