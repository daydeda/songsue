-- 0016: Audience targeting for shop products.
-- Mirrors the events visibility model (shared predicate src/lib/event-access.ts): a
-- product can be restricted to certain roles, majors, and/or Thai|international
-- students. allowed_roles / allowed_majors are jsonb string[] (NULL/[] = no
-- restriction on that axis); target_thai / target_international default true (both
-- false is treated as both true by the predicate). Shop admins always see every
-- product regardless of these columns. Additive and non-destructive: existing
-- products get NULL arrays + both targets true, i.e. visible to everyone as before.
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — every statement is guarded so a second run is a no-op.

ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS allowed_roles jsonb;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS allowed_majors jsonb;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS target_thai boolean DEFAULT true;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS target_international boolean DEFAULT true;
