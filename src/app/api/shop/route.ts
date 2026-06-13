import { auth } from "@/auth";
import { db } from "@/db";
import { shopOrderItems, shopOrders, shopProducts, shopSettings, shopVariants } from "@/db/schema";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/shop — the storefront for logged-in buyers: active products (with their
// variants + remaining stock) and the payment settings (QR + instructions).
// Returns { enabled, paymentInfo, qrImageUrl, products: [...] }.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [settings] = await db
      .select()
      .from(shopSettings)
      .orderBy(desc(shopSettings.updatedAt))
      .limit(1);

    // Shop turned off — hide everything but report the flag so the UI can explain.
    if (!settings || !settings.enabled) {
      return NextResponse.json({ enabled: false, paymentInfo: "", qrImageUrl: null, products: [] });
    }

    const products = await db
      .select()
      .from(shopProducts)
      .where(eq(shopProducts.isActive, true))
      .orderBy(asc(shopProducts.sortOrder), desc(shopProducts.createdAt));

    const productIds = products.map((p) => p.id);
    const variants = productIds.length
      ? await db
          .select()
          .from(shopVariants)
          .where(inArray(shopVariants.productId, productIds))
          .orderBy(asc(shopVariants.sortOrder))
      : [];

    // Units already committed per variant (everything not rejected counts against
    // stock). One grouped query instead of N.
    const variantIds = variants.map((v) => v.id);
    const soldRows = variantIds.length
      ? await db
          .select({
            variantId: shopOrderItems.variantId,
            sold: sql<number>`coalesce(sum(${shopOrderItems.quantity}), 0)`,
          })
          .from(shopOrderItems)
          .innerJoin(shopOrders, eq(shopOrderItems.orderId, shopOrders.id))
          .where(and(inArray(shopOrderItems.variantId, variantIds), ne(shopOrders.status, "rejected")))
          .groupBy(shopOrderItems.variantId)
      : [];
    const soldByVariant = new Map(soldRows.map((r) => [r.variantId, Number(r.sold)]));

    const now = new Date();
    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrls: p.imageUrls ?? (p.imageUrl ? [p.imageUrl] : []),
      maxPerOrder: p.maxPerOrder,
      opensAt: p.opensAt,
      closesAt: p.closesAt,
      // 'upcoming' (before opensAt) | 'closed' (after closesAt) | 'open'
      saleStatus: p.opensAt && now < p.opensAt ? "upcoming" : p.closesAt && now > p.closesAt ? "closed" : "open",
      variants: variants
        .filter((v) => v.productId === p.id)
        .map((v) => ({
          id: v.id,
          label: v.label,
          allowCustom: v.allowCustom,
          // null stock = unlimited; otherwise remaining after committed units.
          remaining: v.stock == null ? null : Math.max(0, v.stock - (soldByVariant.get(v.id) ?? 0)),
        })),
    }));

    return NextResponse.json({
      enabled: true,
      paymentInfo: settings.paymentInfo,
      qrImageUrl: settings.qrImageUrl,
      products: result,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
