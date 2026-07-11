// Role constants for the club-president event-proposal flow. Mirrors the style
// of src/lib/strikes.ts.

// Only club_president may submit a proposal — it's scoped to a clubId, and
// major_president has no clubId scope (EventScopeService only ever populates
// majors[] for that role, never clubIds[]; see event-scope.service.ts).
export const SUBMIT_PROPOSAL_ROLES = ["club_president"] as const;

// Same staff set that may create a real event today (POST /api/admin/events) —
// reviewing/rejecting/converting a proposal is just "can create events" plus
// EventScopeService-based ownership scoping for president submissions.
export const REVIEW_PROPOSAL_ROLES = ["super_admin", "admin", "registration", "organizer"] as const;

export const PROPOSAL_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
