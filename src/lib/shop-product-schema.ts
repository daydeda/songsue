import { z } from "zod";

// Shared validation for creating/updating a shop product. Lives outside the route
// files because Next.js route modules may only export handlers + config.
export const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).default(""),
  price: z.number().int().min(0).max(1_000_000),
  imageUrls: z.array(z.string().url()).max(8).default([]),
  // null = unlimited per buyer.
  maxPerOrder: z.number().int().min(1).max(999).nullable().default(null),
  // Sale window — ISO strings (or null). null = unbounded that side.
  opensAt: z.coerce.date().nullable().default(null),
  closesAt: z.coerce.date().nullable().default(null),
  isActive: z.boolean().default(true),
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
