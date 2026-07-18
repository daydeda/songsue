-- 0030: Fix false-positive "President edited this event" badge.
--
-- 0027_slimy_nightcrawler.sql added events.details_review_status as
-- `DEFAULT 'pending' NOT NULL` with no backfill, so every event that already
-- existed at that point was retroactively stamped 'pending' even though no
-- president ever touched it (pending_details_changes stayed NULL for those
-- rows). The admin UI's badge only checked detailsReviewStatus === 'pending',
-- so those events show a permanent, false "President edited this event"
-- badge with nothing to actually review.
--
-- This flips those rows back to 'approved' — but ONLY where there is no
-- actual pending diff sitting on the row (pending_details_changes IS NULL),
-- so a genuine, still-unreviewed president edit is never silently approved.
-- Idempotent: re-running only touches rows that are still in the false state.
UPDATE events
SET details_review_status = 'approved'
WHERE details_review_status = 'pending'
  AND pending_details_changes IS NULL;
