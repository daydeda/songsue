-- Per-product delivery pricing (overrides the shop-wide flat fee fallback).
-- delivery_fee = base ฿ fee (NULL = use shop_settings.delivery_fee fallback).
-- delivery_tiers = jsonb [{minQty,fee}] ascending quantity thresholds; the highest
-- applicable minQty wins ("order more than N → fee goes up"). An order's total
-- shipping is the SUM of each product's computed fee. See src/lib/shop-delivery.ts.
-- Additive, nullable, non-destructive, idempotent. Mirrors migrate.ts step 50.
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS delivery_fee integer;
ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS delivery_tiers jsonb;
