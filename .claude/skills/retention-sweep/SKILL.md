---
name: retention-sweep
description: REPORT-ONLY PDPA data-retention analysis for ActiveCAMT. Given candidate retention durations, it reports how many rows WOULD be affected per table — it NEVER deletes or anonymizes anything. A working purge requires a written retention policy + a /safe-deploy migration first. Use to scope a retention policy, not to enforce one.
---

# Retention Sweep (ActiveCAMT) — DRY-RUN / REPORT-ONLY

PDPA expects data minimization: personal data shouldn't be kept past its purpose.
This skill helps you *scope* a retention policy by reporting impact. **It does not, and
will not, delete or modify any data.** Enforcement is deliberately out of scope until a
policy exists, because prod deletion is the single most dangerous operation in this repo
(a `DELETE` once wiped the whole activity feed; see `/safe-deploy` and `src/db/guard.ts`).

## Why it's report-only
- **No retention policy is defined yet** — how long to keep attendance / medical fields / form submissions / shop orders is a decision the team must make, not one to infer.
- A purge against prod is irreversible and high-risk; it must go through `/safe-deploy` with the DELETE-rule scrutiny, never an ad-hoc script.

## What it does now
Given candidate durations from the user (e.g. "attendance > 2 years", "inactive-student medical fields > 1 year"), run **read-only `SELECT COUNT(*)`** per relevant table to report what *would* be affected:
- `attendance` (by check-in/event date), `formSubmissions`, `scoreHistory`, `shopOrders` (+ items), and **medical fields on `users`** for long-inactive accounts.
Present a table: table · cutoff · rows affected. Then STOP.

## NEVER
- Never run `DELETE` / `UPDATE` / `TRUNCATE` against any database from this skill. Counts only.
- Never touch `audit_logs` — it's retained on a separate legal/tamper-evidence basis (see `/audit-verify`).
- Prefer counting against the **local** DB (`/db-local`); if pointed at prod, issue **only** `SELECT COUNT`, never a write.

## When a policy IS decided (handoff, not done here)
Any future enforcement must: be a written policy first; **anonymize/convert-in-place rather than hard-delete** where feasible (e.g. null the medical fields, keep the attendance row); be idempotent + tightly scoped; require `CONFIRM=yes` per `guard.ts`; exclude `audit_logs`; and ship via `/safe-deploy`. Build that as a separate, reviewed migration — not from this skill.

## Output
An impact-count table per proposed cutoff, and an explicit statement that **nothing was deleted** and a written policy + `/safe-deploy` migration are required before any purge.
