---
name: pdpa-export
description: Assemble a consolidated export of ALL data ActiveCAMT holds about a single student (PDPA subject-access request), or guide PDPA erasure — admin-only, always audit-logged, with medical detail gated to admin roles and audit_logs never included/erased. Use for a data-subject access or erasure request for one student.
---

# PDPA Export / Erasure (ActiveCAMT)

Thailand's PDPA gives a data subject the right to access and to erasure. This skill
assembles a consolidated, accurate export of everything held about **one student**, or
guides erasure — safely and with an audit trail. It is **admin-driven**: reading a
student's medical detail is itself an auditable event.

## Where a student's data lives (read these tables)
- `users` — profile + **medical detail** (`chronicDiseases`, `medicalHistory`, `drugAllergies`, `foodAllergies`, `dietaryRestrictions`, `faintingHistory`, `emergencyContacts`, `emergencyMedication`) + `pdpaConsent`, `qrToken`.
- `attendance` — their check-ins (`studentId`), incl. `medsCheckOption`.
- `formSubmissions` — their evaluation answers (incl. "file" answer URLs).
- `shopOrders` (+ `shopOrderItems`) — orders where they are the buyer.
- `accounts` / `sessions` / `authenticators` — auth records (include minimally or note as auth metadata).
- `scoreHistory` is **per-house, not per-student** — individual point contributions are not stored against a student; note this rather than inventing per-student scores.

## NEVER export or erase
- **`audit_logs`.** It's an append-only, tamper-evident SHA256 chain and is retained on a separate legal/security basis. It is not part of a subject's data export, and erasing a user does **not** rewrite their audit rows (their `actorId`/`targetId` are baked into row hashes; the FKs were dropped for exactly this — migration step 27).

## PDPA tiering (who may see what)
- **Medical detail** is included only when the requesting admin is `admin`/`super_admin`. `registration`/`organizer` get the non-medical subset only (the signal rule).
- Every assembly that reads medical detail MUST write an audit log (e.g. `AuditService.logAction({ actorId, targetId: studentId, action: "Exported PDPA data for <studentId>", ipAddress })`).

## Workflow
1. **Identify** the student (by `id` / `studentId` / `cmu.ac.th` email) and **confirm the requesting admin's authorization** (role).
2. **Choose mode:** export (read-only) or erasure (destructive — see below).
3. **Export:** gather across the tables above (read-only), tiered by the requester's role, into one file (JSON, or XLSX matching `src/app/api/admin/events/[id]/export/route.ts`). **Write the audit log** for the access. Hand the file to the authorized admin.
4. **Erasure:** use the EXISTING `DELETE /api/admin/users/[id]` path — it already cascades (`attendance`, nulls `scannedBy`, cascades sessions/accounts/form_submissions) and writes a PDPA erasure audit record, with the FK caveats handled. **Do not write a new destructive path.** Confirm explicitly first — erasure is irreversible.

## Hard rules
- Admin-only; audit every read of medical detail.
- Never include `audit_logs` content in an export; never erase audit rows.
- **Do not transmit the export externally** (email/upload/paste) — handing the file to the authorized admin is the boundary; onward delivery to the data subject is their PDPA responsibility.
- Erasure requires explicit confirmation and uses the existing endpoint only.

## Make it permanent (optional)
If this should be a real endpoint (`GET /api/admin/students/[id]/export`), build it with `/new-admin-route` so the gate + audit are baked in, then this skill becomes the spec.
