import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { adminLandingHrefForRoles, effectiveRoles, isGlobalRegistrationPosition } from "@/lib/admin-access";
import { REVIEW_PROPOSAL_ROLES } from "@/lib/event-proposals";
import { EventProposalsClient } from "./EventProposalsClient";

export const dynamic = "force-dynamic";

// club_president/major_president are scanner-only and never reach this page —
// SCANNER_ONLY_PAGES doesn't list /admin/proposals, and this check further
// restricts entry to REVIEW_PROPOSAL_ROLES (the same staff set allowed to
// create real events, src/lib/event-proposals.ts), reused here so the redirect
// can't drift from the GET/PATCH /api/admin/event-proposals API's actual gate.
export default async function AdminProposalsPage() {
  const session = await auth();
  const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
  const position = session?.user?.position;
  // Reviewing proposals has no club/major-scoped equivalent — only a GLOBAL
  // registration position (smo/anusmo) gets parity, matching the API's gate.
  const canReview = myRoles.some((r) => (REVIEW_PROPOSAL_ROLES as readonly string[]).includes(r))
    || isGlobalRegistrationPosition(myRoles, position);
  if (!canReview) {
    redirect(adminLandingHrefForRoles(myRoles, position));
  }

  return <EventProposalsClient />;
}
