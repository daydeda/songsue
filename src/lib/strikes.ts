// No-show strike-out constants. See docs/agile/01-product-backlog.md
// (US-STRI-15a/b/c) for the underlying design.

// Individual points deducted from a student per confirmed no-show. This is the
// default pre-filled in the apply-strikes UI; staff with APPLY_STRIKES_ROLES
// may override it per application, bounded by NO_SHOW_PENALTY_MIN/MAX.
export const NO_SHOW_PENALTY_POINTS = 10;
export const NO_SHOW_PENALTY_MIN = 1;
export const NO_SHOW_PENALTY_MAX = 50;

// noShowCount at which users.registrationBlocked is set — pre-registration for
// new events is refused until a super_admin/admin resets the student's strikes.
export const NO_SHOW_STRIKE_THRESHOLD = 3;

// Roles allowed to confirm/apply no-show strikes for an event (organizers run
// their own events; registration is scanner/roster-facing, not punitive).
// smo is unscoped like staff; club_president/major_president are additionally
// scoped to events they own (see EventScopeService in apply-strikes/route.ts).
export const APPLY_STRIKES_ROLES = ["super_admin", "admin", "organizer", "smo", "club_president", "major_president"] as const;

// Roles allowed to reset a student's strikes/block — narrower than apply, since a
// reset erases the deterrent and should be a deliberate staff decision.
export const RESET_STRIKES_ROLES = ["super_admin", "admin"] as const;
