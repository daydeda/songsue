// Shared event/calendar visibility predicate.
//
// This is the SINGLE source of truth for "may this viewer see this item?", used
// by both /api/events and the calendar (/api/calendar + the .ics feed). Events
// and calendar_entries share identical visibility columns (allowedRoles,
// allowedMajors, targetThai, targetInternational), so they share this logic —
// calendar visibility matches event visibility by construction.
//
// NOTE: this does NOT include the "always show events I'm registered for"
// attendance bypass — that is event-specific and stays in /api/events. Calendar
// entries have no attendance concept.

// Admin roles bypass all role/major/audience restrictions.
const ADMIN_ROLES = ["super_admin", "admin", "registration", "organizer"];

export interface EligibilityItem {
  allowedRoles?: string[] | null;
  allowedMajors?: string[] | null;
  targetThai?: boolean | null;
  targetInternational?: boolean | null;
}

export interface Viewer {
  isAdminRole: boolean;
  /** roles with professor/officer normalized to "staff" */
  effectiveRoles: string[];
  userMajor: string | null;
  isThai: boolean;
  isIntl: boolean;
}

/**
 * Thai vs international is derived from the student id: the first of the last
 * three digits being "5" marks an international student. Unknown/short ids
 * default to Thai (matches the historic /api/events behaviour).
 */
export function deriveThaiIntl(studentId: string | null | undefined): {
  isThai: boolean;
  isIntl: boolean;
} {
  const cleanId = (studentId || "").trim();
  let isThai = true;
  let isIntl = false;
  if (cleanId.length >= 3) {
    const lastThreeDigitFirst = cleanId.slice(-3)[0];
    if (lastThreeDigitFirst === "5") {
      isThai = false;
      isIntl = true;
    }
  }
  return { isThai, isIntl };
}

/** Build a Viewer from a user's roles, student id, and major. */
export function buildViewer(opts: {
  roles: string[] | null | undefined;
  studentId: string | null | undefined;
  major: string | null | undefined;
}): Viewer {
  const userRoles = opts.roles && opts.roles.length ? opts.roles : ["student"];
  const isAdminRole = userRoles.some((r) => ADMIN_ROLES.includes(r));
  // Normalize staff aliases (professor, officer → staff) to match allowedRoles.
  const effectiveRoles = userRoles.map((r) =>
    ["professor", "officer"].includes(r) ? "staff" : r
  );
  const { isThai, isIntl } = deriveThaiIntl(opts.studentId);
  return { isAdminRole, effectiveRoles, userMajor: opts.major ?? null, isThai, isIntl };
}

/** Whether an authenticated viewer is eligible to see an item. */
export function isEligibleFor(item: EligibilityItem, viewer: Viewer): boolean {
  const targetThai = item.targetThai ?? true;
  const targetInternational = item.targetInternational ?? true;

  // If both targets are unchecked, anyone can join (default to both true).
  const effectiveThai = !targetThai && !targetInternational ? true : targetThai;
  const effectiveIntl = !targetThai && !targetInternational ? true : targetInternational;

  if (viewer.isThai && !effectiveThai) return false;
  if (viewer.isIntl && !effectiveIntl) return false;

  // Role-based access control. Admin roles always bypass.
  if (!viewer.isAdminRole && item.allowedRoles && item.allowedRoles.length > 0) {
    const hasMatchingRole = viewer.effectiveRoles.some((r) =>
      item.allowedRoles!.includes(r)
    );
    if (!hasMatchingRole) return false;
  }

  // Major-based access control. Admin roles always bypass.
  if (!viewer.isAdminRole && item.allowedMajors && item.allowedMajors.length > 0) {
    if (!viewer.userMajor || !item.allowedMajors.includes(viewer.userMajor)) {
      return false;
    }
  }

  return true;
}

/**
 * Whether an unauthenticated guest may see an item. A guest has no major (so any
 * major restriction excludes them) and is only shown role-restricted items that
 * explicitly include "student".
 */
export function isEligibleForGuest(item: EligibilityItem): boolean {
  if (item.allowedMajors && item.allowedMajors.length > 0) return false;
  if (item.allowedRoles && item.allowedRoles.length > 0) {
    return item.allowedRoles.includes("student");
  }
  return true;
}
