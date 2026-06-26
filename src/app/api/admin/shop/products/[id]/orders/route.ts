import { auth } from "@/auth";
import { db } from "@/db";
import { shopOrderItems, shopOrders, shopProducts, users } from "@/db/schema";
import { isShopAdmin } from "@/lib/shop-auth";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/admin/shop/products/[id]/orders — every order line for one product,
// joined to buyer + order, newest first. Powers the per-product .xlsx export so
// admins can see who ordered which option and total quantities to fulfil.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!isShopAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const [product] = await db
      .select({ name: shopProducts.name })
      .from(shopProducts)
      .where(eq(shopProducts.id, id))
      .limit(1);
    if (!product) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await db
      .select({
        orderId: shopOrders.id,
        status: shopOrders.status,
        createdAt: shopOrders.createdAt,
        reviewedAt: shopOrders.reviewedAt,
        rejectionReason: shopOrders.rejectionReason,
        orderTotal: shopOrders.totalAmount,
        slipPath: shopOrders.slipPath,
        note: shopOrders.note,
        variantLabel: shopOrderItems.variantLabel,
        customValues: shopOrderItems.customValues,
        quantity: shopOrderItems.quantity,
        unitPrice: shopOrderItems.unitPrice,
        buyerName: users.name,
        nickname: users.nickname,
        studentId: users.studentId,
        email: users.email,
        phone: users.phone,
        major: users.major,
        houseId: users.houseId,
      })
      .from(shopOrderItems)
      .innerJoin(shopOrders, eq(shopOrderItems.orderId, shopOrders.id))
      .leftJoin(users, eq(shopOrders.buyerId, users.id))
      .where(eq(shopOrderItems.productId, id))
      .orderBy(desc(shopOrders.createdAt));

    return NextResponse.json({ productName: product.name, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
