import { auth } from "@/auth";
import { db } from "@/db";
import { shopOrderItems, shopOrders, shopProducts, shopVariants } from "@/db/schema";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { isShopAdmin } from "@/lib/shop-auth";
import { productSchema } from "@/lib/shop-product-schema";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/admin/shop/products — all products (incl. inactive) with their variants
// and committed (non-rejected) sold counts, for the admin product manager.
export async function GET() {
  try {
    const session = await auth();
    if (!isShopAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await db
      .select()
      .from(shopProducts)
      .orderBy(asc(shopProducts.sortOrder), desc(shopProducts.createdAt));

    const productIds = products.map((p) => p.id);
    const variants = productIds.length
      ? await db.select().from(shopVariants).where(inArray(shopVariants.productId, productIds)).orderBy(asc(shopVariants.sortOrder))
      : [];

    const variantIds = variants.map((v) => v.id);
    const soldRows = variantIds.length
      ? await db
          .select({ variantId: shopOrderItems.variantId, sold: sql<number>`coalesce(sum(${shopOrderItems.quantity}), 0)` })
          .from(shopOrderItems)
          .innerJoin(shopOrders, eq(shopOrderItems.orderId, shopOrders.id))
          .where(and(inArray(shopOrderItems.variantId, variantIds), ne(shopOrders.status, "rejected")))
          .groupBy(shopOrderItems.variantId)
      : [];
    const soldByVariant = new Map(soldRows.map((r) => [r.variantId, Number(r.sold)]));

    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      imageUrls: p.imageUrls ?? (p.imageUrl ? [p.imageUrl] : []),
      maxPerOrder: p.maxPerOrder,
      opensAt: p.opensAt,
      closesAt: p.closesAt,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      variants: variants
        .filter((v) => v.productId === p.id)
        .map((v) => ({ id: v.id, label: v.label, stock: v.stock, allowCustom: v.allowCustom, sold: soldByVariant.get(v.id) ?? 0 })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/shop/products — create a product and its variants.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!isShopAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const data = productSchema.parse(await req.json());

    const productId = await db.transaction(async (tx) => {
      const [product] = await tx
        .insert(shopProducts)
        .values({
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrls[0] ?? null,
          imageUrls: data.imageUrls,
          maxPerOrder: data.maxPerOrder,
          opensAt: data.opensAt,
          closesAt: data.closesAt,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        })
        .returning({ id: shopProducts.id });

      await tx.insert(shopVariants).values(
        data.variants.map((v, i) => ({ productId: product.id, label: v.label, stock: v.stock, allowCustom: v.allowCustom, sortOrder: i }))
      );

      await AuditService.logActionInternal(tx, {
        actorId: session!.user!.id!,
        action: `Created shop product "${data.name}"`,
        ipAddress: getClientIp(req),
      });

      return product.id;
    });

    return NextResponse.json({ success: true, id: productId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
