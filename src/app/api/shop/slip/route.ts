import { auth } from "@/auth";
import { hardenImageUpload, ImageValidationError } from "@/lib/image-upload";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { uploadSlip } from "@/lib/shop-storage";
import { NextResponse } from "next/server";

// POST /api/shop/slip — upload a payment slip to the PRIVATE bucket. Returns the
// object key ({ path }) which the buyer then submits with their order. The slip is
// re-encoded (no raw bytes stored) and never exposed by public URL.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Throttle: slip re-encoding (sharp) is CPU-heavy and runs on the single
    // self-hosted instance, so a signed-in user looping uploads could DoS it.
    // Mirrors /api/forms/upload (30/min/IP).
    const limiter = await rateLimit(getClientIp(req), 30, 60000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please slow down." },
        { status: 429, headers: { "Retry-After": Math.ceil((limiter.resetTime - Date.now()) / 1000).toString() } },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const { buffer, ext } = await hardenImageUpload(file, { maxBytes: 10 * 1024 * 1024, maxDim: 1600 });
    const path = await uploadSlip(buffer, ext);

    return NextResponse.json({ path });
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Slip upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
