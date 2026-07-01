-- 0017: Generic per-product custom fields (jersey name/number, engraving, etc.).
-- shop_products.custom_fields stores the field CONFIG (jsonb array of
-- {key,label,type,required,maxLength|min|max|options}); shop_order_items.custom_values
-- stores the buyer's snapshotted answers ([{label,value}]) captured at checkout, so
-- order history + the admin export stay readable even if the config is later edited.
-- Both nullable (NULL = no custom fields / none filled). See src/lib/shop-custom-fields.ts.
--
-- The authoritative runner is src/db/migrate.ts (`npm run db:migrate`); this file
-- mirrors it for parity with the drizzle/ migration history. Apply ONE of them, not
-- both — every statement is guarded so a second run is a no-op.

ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS custom_fields jsonb;
ALTER TABLE shop_order_items ADD COLUMN IF NOT EXISTS custom_values jsonb;
