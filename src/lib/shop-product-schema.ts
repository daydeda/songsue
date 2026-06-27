import { z } from "zod";
import { customFieldSchema } from "@/lib/shop-custom-fields";
import { deliveryTierSchema } from "@/lib/shop-delivery";

// Shared validation for creating/updating a shop product. Lives outside the route
// files because Next.js route modules may only export handlers + config.
export const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  price: z.number().int().min(0).max(1_000_000),
  // Bare string (not .url()): the self-hosted /api/upload returns relative paths
  // like "/uploads/x.jpg", which are valid here (events stores them the same way).
  imageUrls: z.array(z.string()).max(8).default([]),
  // null = unlimited per buyer.
  maxPerOrder: z.number().int().min(1).max(999).nullable().default(null),
  // Sale window — ISO strings (or null). null = unbounded that side.
  opensAt: z.coerce.date().nullable().default(null),
  closesAt: z.coerce.date().nullable().default(null),
  isActive: z.boolean().default(true),
  // Audience targeting (mirrors events). Empty arrays = no restriction on that
  // axis; both targets default true. Admins always see every product regardless.
  allowedRoles: z.array(z.string().max(40)).max(20).default([]),
  allowedMajors: z.array(z.string().max(40)).max(20).default([]),
  targetThai: z.boolean().default(true),
  targetInternational: z.boolean().default(true),
  // Per-product personalization fields (e.g. jersey name/number). Empty = none.
  customFields: z.array(customFieldSchema).max(10).default([]),
  // Per-product delivery pricing. deliveryFee = base ฿ (null = shop-wide fallback);
  // deliveryTiers = quantity thresholds ([{minQty,fee}], highest applicable wins).
  deliveryFee: z.number().int().min(0).max(1_000_000).nullable().default(null),
  deliveryTiers: z.array(deliveryTierSchema).max(8).default([]),
  sortOrder: z.number().int().default(0),
  variants: z
    .array(
      z.object({
        id: z.string().uuid().optional(), // present = update existing, absent = new
        label: z.string().min(1).max(200),
        stock: z.number().int().min(0).max(100_000).nullable().default(null), // null = unlimited
        allowCustom: z.boolean().default(false), // "Other (specify)" — buyer types a value
      })
    )
    .min(1)
    .max(30),
});
