# Feature Spec — Multi-Day Partial Attendance / การมาไม่ครบทุกวัน

> **STATUS: DRAFT — DECISION PENDING. NOT YET IMPLEMENTED.**
> Parked spec for how the system treats a student who attends **some but not all**
> sessions of a multi-day event. Sibling of
> [`multi-day-points-policy.md`](./multi-day-points-policy.md) — that file decides *points*,
> this one decides *what partial attendance means and how it is shown/handled*.
> Decide before building the reporting layer.

---

## 1. Context / บริบท

With multi-day check-in (one `event_sessions` row per day, `attendance` keyed per session),
a student can end up in any of these states on a 2-day event:

| State | Day 1 | Day 2 |
|---|---|---|
| Full | ✅ attended | ✅ attended |
| Partial (front) | ✅ attended | ❌ no-show |
| Partial (back) | ❌ no-show | ✅ attended |
| Full no-show | ❌ | ❌ |

The data already captures this (each session has its own attendance row with `status`
`registered` / `attended`). The open questions are about **interpretation and consequences**,
which are policy, not data — hence parked here.

---

## 2. Open decisions / สิ่งที่ต้องตัดสินใจ

### 2.1 Completion definition
What does "completed the event" mean for reporting/certificates?
- **All sessions required** — must attend every session.
- **Threshold** — attend ≥ N of M sessions (e.g. 1 of 2).
- **Per-session only** — no "event completion" concept; each day stands alone.

> Ties directly to the points model in `multi-day-points-policy.md §2.1`
> (Model B "all-or-nothing" implies "all sessions required").

### 2.2 Reporting / admin view
- Attendance report should show a **per-session breakdown** plus a roll-up column
  (e.g. `Day 1 ✅ / Day 2 ❌ → Partial`). The plan already routes session-aware tallies
  through `src/app/api/admin/events/[id]/report/route.ts` and `/export/route.ts`.
- Define the roll-up labels: `Full` / `Partial` / `No-show`, in all 4 languages (EN/TH/MM/CN).

### 2.3 Consequences of a partial / no-show day
- **Points:** governed by `multi-day-points-policy.md` (per-day vs all-or-nothing).
- **Strike-out coupling:** a no-show on a *required* day may count as a strike under the
  parked Strike-out feature. Open question carried in the points doc §3 — keep the two specs
  in sync (a partial event = at least one no-show day = at least one strike candidate).
- **Seat reclaim:** since walk-ins re-open per day (decision #5), a Day-1 no-show could free a
  Day-2 seat for the waitlist. Decide whether reclaim runs per session.

### 2.4 Notifications (optional, future)
- Should a student who attended Day 1 but is registered for Day 2 get a reminder? Out of scope
  for the first build; noted so it isn't re-discovered later.

---

## 3. What is NOT in question / สิ่งที่ชัดเจนแล้ว

- The **raw data** fully supports partial attendance with no schema change beyond the
  per-session attendance model — every session has its own `status`. This spec is purely about
  *policy and presentation*, so it can be decided/changed **after** multi-day check-in ships,
  without another migration.
- `medsCheckOption` is recorded per day (decision #4), so medical handling on a partially-
  attended event is already correct — each attended day carries its own meds-check.

---

## 4. Decisions needed before build / ต้องเคาะก่อนเริ่มทำ

- [ ] Completion definition (all / threshold / per-session-only).
- [ ] Roll-up labels + 4-language strings for the report/export.
- [ ] Per-session seat reclaim on a no-show day (yes/no) — coordinate with Strike-out.
- [ ] Confirm consequences stay consistent with `multi-day-points-policy.md`.
