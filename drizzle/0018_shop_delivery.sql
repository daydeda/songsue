-- 0018: Shop delivery / fulfillment (Phase 2 of the merch work).
-- shop_settings gains a flat-fee delivery config (delivery_enabled / delivery_fee /
-- pickup_info). shop_orders gains the per-order choice (fulfillment 'pickup'|'delivery')
-- + recipient name/phone/address (PDPA personal data, shop-admin only) + shipping_fee
-- (a snapshot of delivery_fee folded into total_amount at checkout). Existing orders
-- default to 'pickup' with fee 0 and NULL recipient fields, i.e. unchanged.
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — every statement is guarded so a second run is a no-op.

ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS delivery_fee integer NOT NULL DEFAULT 0;
ALTER TABLE shop_settings ADD COLUMN IF NOT EXISTS pickup_info text NOT NULL DEFAULT '';
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS fulfillment text NOT NULL DEFAULT 'pickup';
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS recipient_phone text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_address text;
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS shipping_fee integer NOT NULL DEFAULT 0;
