import { auth } from "@/auth";
import { db } from "@/db";
import { shopProducts, shopVariants } from "@/db/schema";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { isShopAdmin } from "@/lib/shop-auth";
import { and, eq, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { productSchema } from "@/lib/shop-product-schema";

export const dynamic = "force-dynamic";

// PUT /api/admin/shop/products/[id] — update a product and reconcile its variants:
// variants with an id are updated, new ones inserted, and any existing variant not
// in the payload is deleted (order_items keep their snapshot via ON DELETE SET NULL).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isShopAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const data = productSchema.parse(await req.json());

    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: shopProducts.id }).from(shopProducts).where(eq(shopProducts.id, id)).limit(1);
      if (!existing) throw new z.ZodError([{ code: "custom", message: "Product not found", path: ["id"] }]);

      await tx
        .update(shopProducts)
        .set({
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrls[0] ?? null,
          imageUrls: data.imageUrls,
          maxPerOrder: data.maxPerOrder,
          opensAt: data.opensAt,
          closesAt: data.closesAt,
          isActive: data.isActive,
          allowedRoles: data.allowedRoles,
          allowedMajors: data.allowedMajors,
          targetThai: data.targetThai,
          targetInternational: data.targetInternational,
          customFields: data.customFields,
          sortOrder: data.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(shopProducts.id, id));

      const keepIds = data.variants.map((v) => v.id).filter((v): v is string => Boolean(v));
      // Delete variants the admin removed.
      if (keepIds.length) {
        await tx.delete(shopVariants).where(and(eq(shopVariants.productId, id), notInArray(shopVariants.id, keepIds)));
      } else {
        await tx.delete(shopVariants).where(eq(shopVariants.productId, id));
      }

      // Upsert each variant in order (sortOrder = position).
      for (let i = 0; i < data.variants.length; i++) {
        const v = data.variants[i];
        if (v.id) {
          await tx
            .update(shopVariants)
            .set({ label: v.label, stock: v.stock, allowCustom: v.allowCustom, sortOrder: i })
            .where(and(eq(shopVariants.id, v.id), eq(shopVariants.productId, id)));
        } else {
          await tx.insert(shopVariants).values({ productId: id, label: v.label, stock: v.stock, allowCustom: v.allowCustom, sortOrder: i });
        }
      }

      await AuditService.logActionInternal(tx, {
        actorId: session!.user!.id!,
        action: `Updated shop product "${data.name}"`,
        ipAddress: getClientIp(req),
      });
    });

    return NextResponse.json({ success: true });
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

// DELETE /api/admin/shop/products/[id] — remove a product. Existing order line
// items keep their snapshot (ON DELETE SET NULL on product_id/variant_id), so
// order history stays intact. Prefer toggling isActive=false to hide a product
// while keeping it; delete is for mistakes.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isShopAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const [product] = await db.select({ name: shopProducts.name }).from(shopProducts).where(eq(shopProducts.id, id)).limit(1);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.transaction(async (tx) => {
      await tx.delete(shopProducts).where(eq(shopProducts.id, id));
      await AuditService.logActionInternal(tx, {
        actorId: session!.user!.id!,
        action: `Deleted shop product "${product.name}"`,
        ipAddress: getClientIp(req),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
