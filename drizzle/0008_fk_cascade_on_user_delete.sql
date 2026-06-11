-- Add ON DELETE behavior to foreign keys that reference users.id
--
-- Why: deleting a user failed in production with a foreign-key violation
-- because attendance and audit_logs referenced users.id with NO ACTION.
-- (accounts / sessions / authenticator / form_submissions already cascade.)
--
-- This migration ONLY changes the ON DELETE rule of existing constraints.
-- It does NOT drop tables or delete any rows. Re-adding each constraint
-- re-validates instantly because every row already satisfies the FK.
--
-- Behavior (matches the app-level cleanup in /api/admin/users/[id]):
--   attendance.student_id -> CASCADE  (remove the user's own registrations)
--   attendance.scanned_by -> SET NULL (keep other students' attendance)
--   audit_logs.actor_id   -> SET NULL (preserve the audit trail)
--   audit_logs.target_id  -> SET NULL (preserve the audit trail)
--
-- Safe to run more than once (DROP ... IF EXISTS before each ADD).

-- attendance.student_id -> ON DELETE CASCADE
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_student_id_users_id_fk;
ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_users_id_fk
  FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE cascade ON UPDATE no action;

-- attendance.scanned_by -> ON DELETE SET NULL
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_scanned_by_users_id_fk;
ALTER TABLE attendance ADD CONSTRAINT attendance_scanned_by_users_id_fk
  FOREIGN KEY (scanned_by) REFERENCES public.users(id) ON DELETE set null ON UPDATE no action;

-- audit_logs.actor_id -> ON DELETE SET NULL
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_users_id_fk;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_id_users_id_fk
  FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE set null ON UPDATE no action;

-- audit_logs.target_id -> ON DELETE SET NULL
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_target_id_users_id_fk;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_target_id_users_id_fk
  FOREIGN KEY (target_id) REFERENCES public.users(id) ON DELETE set null ON UPDATE no action;
