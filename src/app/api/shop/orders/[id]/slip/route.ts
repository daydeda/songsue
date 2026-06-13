import { auth } from "@/auth";
import { db } from "@/db";
import { shopOrders } from "@/db/schema";
import { downloadSlip } from "@/lib/shop-storage";
import { isShopAdmin } from "@/lib/shop-auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/shop/orders/[id]/slip — stream the payment slip bytes. PDPA-gated: only
// the buyer who placed the order or a shop admin may view it. The slip is proxied
// through here (never a public URL), so access is checked on every request.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const [order] = await db
      .select({ buyerId: shopOrders.buyerId, slipPath: shopOrders.slipPath })
      .from(shopOrders)
      .where(eq(shopOrders.id, id))
      .limit(1);

    if (!order || !order.slipPath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isOwner = order.buyerId === session.user.id;
    if (!isOwner && !isShopAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { buffer, contentType } = await downloadSlip(order.slipPath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // Private: caches must revalidate auth, never store shared copies.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
