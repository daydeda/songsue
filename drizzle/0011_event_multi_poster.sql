-- 0011: Multi-poster support for events.
-- Events can carry an ordered list of poster image URLs, rendered as a swipeable
-- carousel on the student dashboard. image_urls[0] mirrors the existing image_url
-- cover so legacy single-image consumers (admin list thumbnails, etc.) keep working.
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — every statement is guarded so a second run is a no-op.

ALTER TABLE events ADD COLUMN IF NOT EXISTS image_urls jsonb;

-- Backfill: wrap any existing single image_url into the array so legacy events
-- render in the carousel exactly as before.
UPDATE events
SET image_urls = jsonb_build_array(image_url)
WHERE image_urls IS NULL AND image_url IS NOT NULL AND image_url <> '';
