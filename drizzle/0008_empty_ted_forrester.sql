ALTER TABLE "events" ADD COLUMN "individual_points_awarded" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "first_year_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "forms" ADD COLUMN "individual_points_awarded" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD COLUMN "custom_values" jsonb;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD COLUMN "fulfillment" text DEFAULT 'pickup' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD COLUMN "recipient_name" text;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD COLUMN "recipient_phone" text;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD COLUMN "shipping_address" text;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD COLUMN "shipping_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN "allowed_roles" jsonb;--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN "allowed_majors" jsonb;--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN "target_thai" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN "target_international" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN "custom_fields" jsonb;--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN "delivery_fee" integer;--> statement-breakpoint
ALTER TABLE "shop_products" ADD COLUMN "delivery_tiers" jsonb;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "delivery_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "delivery_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "pickup_info" text DEFAULT '' NOT NULL;