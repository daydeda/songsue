---
name: audit-verify
description: Verify the integrity of ActiveCAMT's append-only audit-log hash chain (tamper evidence) by running AuditService.verifyChainIntegrity — via the existing GET /api/admin/audit-verify route or a local script. Use before a deploy/migration that touches audit_logs or users, periodically, or on any suspicion of tampering. Read-only; a broken chain is a security incident, never "repaired".
---

# Audit Verify (ActiveCAMT)

`audit_logs` is an **append-only SHA256 hash chain**: each row's `rowHash` folds in the
previous row's hash (`prevHash`), serialized by an advisory lock so concurrent appends
can't fork it. Any insert, delete, modification, or reorder of a historical row breaks
the chain and is detectable. `AuditService.verifyChainIntegrity()`
(`src/modules/audit/audit.service.ts`) walks the chain and reports the first break.
Today it's only run by hand — this skill operationalizes it.

## How to run
- **Preferred:** there's already an endpoint — `GET /api/admin/audit-verify` (`src/app/api/admin/audit-verify/route.ts`). Hit it authenticated as `super_admin`/`admin` and read the `ChainVerifyResult` (ok, and if not, the first offending row).
- **Local / CI:** run `verifyChainIntegrity()` against the target DB via a small `tsx` script. Rehearse against the **local** DB (`.env.local`, see `/db-local`); only point at prod read-only and deliberately.

## When to run
- Before/after a migration or deploy that touches `audit_logs` or `users` (user deletion interacts with the dropped audit FKs — migration step 27).
- Periodically as a tamper check, and immediately on any suspicion of tampering.
- Note: it can't be a `/schedule` cron easily if it requires an authenticated session — drive it via the route in an interactive/CI context.

## Hard rules
- **Read-only.** This only verifies; it never writes.
- **Never "fix" a broken chain.** Rewriting or back-filling `audit_logs` to make it validate defeats the entire tamper-evidence guarantee. A break = treat as a **security incident**: capture the first offending row id, stop, and surface it to the user. Do not mutate audit rows.
- Do not export or include audit-log contents in any data export (see `/pdpa-export`).

## Output
`ok: true`, or `ok: false` with the first broken row id and the surrounding context, plus an explicit "treat as a security incident — not auto-repairing" note when broken.
