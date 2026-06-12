// Shared rules for form scheduling (auto open/close window) and access control
// (who may see / fill a form). Used by both API routes and UI so the logic lives
// in exactly one place.

// Roles that can always manage AND fill any form, and are the ones who assign
// others. They never need to be explicitly assigned.
export const FORM_MANAGER_ROLES = ["super_admin", "admin"] as const;

// Roles an admin can assign a form to (by role). Mirrors the participant +
// staff roles used elsewhere in the app.
export const ASSIGNABLE_ROLES = [
  "organizer",
  "registration",
  "staff",
  "smo",
  "anusmo",
  "student",
] as const;

// Minimal shape these helpers need from a form row.
export interface FormAccessShape {
  formType: string;
  isActive: boolean | null;
  isAwarded: boolean | null;
  opensAt: string | Date | null;
  closesAt: string | Date | null;
  assignedRoles?: string[] | null;
  assignedUserIds?: string[] | null;
}

export interface FormUserShape {
  id?: string | null;
  role?: string | null;
}

export function isFormManager(role?: string | null): boolean {
  return !!role && (FORM_MANAGER_ROLES as readonly string[]).includes(role);
}

// Whether `user` is allowed to see/fill the given S (Skill) form. Managers
// always qualify; otherwise the user's role must be assigned OR the user must be
// assigned by id. Empty assignment lists mean only managers can access.
export function canAccessSkillForm(form: FormAccessShape, user: FormUserShape | null | undefined): boolean {
  if (!user) return false;
  if (isFormManager(user.role)) return true;
  const roles = form.assignedRoles ?? [];
  const ids = form.assignedUserIds ?? [];
  if (user.role && roles.includes(user.role)) return true;
  if (user.id && ids.includes(user.id)) return true;
  return false;
}

export type FormAvailability = "awarded" | "closed" | "upcoming" | "open";

// Effective submission state of a form. There is no manual open/close anymore:
// the schedule window (opensAt → closesAt) alone drives the lifecycle, plus the
// finalized flag (isAwarded) once the contest points have been auto-awarded.
//   - before opensAt        → "upcoming"
//   - after closesAt        → "closed" (will auto-award; then "awarded")
//   - otherwise             → "open"
// A null opensAt means "open immediately"; a null closesAt means "never closes".
export function getFormAvailability(form: FormAccessShape, now: Date = new Date()): FormAvailability {
  if (form.isAwarded) return "awarded";
  if (form.opensAt && now < new Date(form.opensAt)) return "upcoming";
  if (form.closesAt && now > new Date(form.closesAt)) return "closed";
  return "open";
}

export function isFormOpenForSubmission(form: FormAccessShape, now: Date = new Date()): boolean {
  return getFormAvailability(form, now) === "open";
}
