# Feature Spec — Multi-Day Event Points Policy / นโยบายคะแนนกิจกรรมหลายวัน

> **STATUS: DRAFT — DECISION PENDING. NOT YET IMPLEMENTED.**
> This is a parked feature spec for multi-day / multi-session events (e.g. CAMT LINK,
> 18–19 June). It records the open decision on **how points are awarded when a student
> must check in on more than one day**, so the rule is written down *before* code is built.
> When implemented, fold the agreed numbers into [`docs/scoring-rules.md`](../scoring-rules.md)
> in the same pull request.

---

## 1. Context / บริบท

Today an event is a single time window and `attendance` is `UNIQUE(eventId, studentId)` —
a student checks in **once per event**. Multi-day support (Option B: `event_sessions`
table, and/or Option C: per-day `attendance`) makes check-in **per session/day**.

That raises a question the current scoring rules do not answer:

> **When a student attends some-or-all days of a multi-day event, how many points do they
> get — and does the house get the event-winner bonus per day or once?**

This must be decided by a human (it is a policy, not a fact the system can infer), so it
lives here until chosen. Related answers already locked in:

- **Registration model is per-event configurable.** Some events: *register once, attend each
  day* (event-level registration + per-session check-in). Some events: *each day independent*
  (per-day registration; walk-ins re-open each day).
- **Walk-ins re-open per day** (decision #5).
- **`medsCheckOption` is recorded per day** (decision #4).

---

## 2. The open decision / สิ่งที่ต้องตัดสินใจ

### 2.1 Individual points (คะแนนบุคคล)

Pick one model **per event** (the system should support all three; the organiser chooses):

| Model | Behaviour | Use when |
|---|---|---|
| **A — Per day** | Student earns the configured points **each day they attend**. Attend 1 of 2 days → half. | Each day has independent value (two distinct workshops). |
| **B — All-or-nothing** | Points awarded **only if the student checks in on every required day**. Miss any day → 0. | Attendance is only meaningful if completed (a 2-day bootcamp). |
| **C — Once, on first check-in** | Points awarded **once**, the first day they show; extra days add nothing. | The multi-day split is logistical, not a higher bar. |

> **Recommendation:** default to **Model A (per day)** because it is the most transparent
> ("you came, you earned") and composes cleanly with the partial-attendance spec. Allow
> organisers to switch an event to B or C. **Not yet decided — awaiting sign-off.**

### 2.2 House event-winner bonus (โบนัสบ้านชนะกิจกรรม)

`scoring-rules.md §3.1` gives the event's `pointsAwarded` to the house with the most
`attended` check-ins once the event ends. For multi-day:

- **Per-day bonus:** compute the winning house **per session** and award each day's bonus
  separately (a house can win Day 1 and lose Day 2).
- **Aggregate bonus:** sum check-ins across all days, award once at event end.

> **Recommendation:** **per-day bonus** — keeps each day competitive and matches Model A.
> **Not yet decided.**

---

## 3. Link to the Strike-out feature / เชื่อมกับระบบ Strike-out

This points policy is **coupled with the parked Strike-out feature** (3-strike no-show
penalty + waitlist seat reclaim — see the team's `todo_strikeout_priority` note). Multi-day
events multiply no-show surface area, so the two must be designed together:

- **What counts as a strike on a multi-day event?** A no-show on *any* required day, or only
  on a fully-missed event? (Leaning: one strike per missed *required* day, capped at one
  strike per event so a 2-day no-show isn't double-punished — **decision pending**.)
- **Seat reclaim per day:** if walk-ins re-open per day (decision #5), a no-show on Day 1
  could free a Day-2 seat for the waitlist. Define whether reclaim is per-session.
- **Interaction with Model B (all-or-nothing):** a student who attends Day 1 but no-shows
  Day 2 earns 0 points *and* may take a strike — confirm that double consequence is intended.

> These Strike-out details are **out of scope for the first multi-day implementation** and
> tracked here so they are not forgotten. Build multi-day check-in first; layer Strike-out on
> top once its own design is settled.

---

## 4. Decisions needed before build / ต้องเคาะก่อนเริ่มทำ

- [ ] Individual-points model default (A / B / C) and whether it's per-event configurable.
- [ ] House bonus: per-day vs aggregate.
- [ ] Strike definition on multi-day events (per missed day vs per event; cap).
- [ ] Whether Model B's "0 points + strike" double consequence is intended.
- [ ] On implementation: mirror the final numbers into `docs/scoring-rules.md`.
