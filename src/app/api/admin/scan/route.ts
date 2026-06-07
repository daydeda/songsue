import { auth } from "@/auth";
import { ScannerService } from "@/modules/events/scanner.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const scanSchema = z.object({
  qrToken: z.string(), // Allows fallback IDs as well
  eventId: z.string().uuid(),
  action: z.enum(["scan", "confirm"]).default("scan"),
  medsCheckOption: z.string().nullish(),
});

export async function POST(req: Request) {
  // Apply IP Rate Limiter (Max 60 requests per minute)
  const ip = getClientIp(req);
  const limiter = rateLimit(ip, 60, 60000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil((limiter.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { qrToken, eventId, action, medsCheckOption } = scanSchema.parse(body);

    // Delegate business operation to ScannerService
    const result = await ScannerService.processScan({
      qrToken,
      eventId,
      action,
      medsCheckOption,
      actorId: session.user.id!,
      ipAddress: ip,
    });

    // Map service domain statuses to HTTP status codes
    if (result.status === "not_found") {
      return NextResponse.json(
        { status: result.status, error: result.error },
        { status: 404 }
      );
    }

    if (result.status === "already_checked_in") {
      return NextResponse.json(
        {
          status: result.status,
          student: result.student,
          checkedInAt: result.checkedInAt,
        },
        { status: 409 }
      );
    }

    if (result.status === "quota_full") {
      return NextResponse.json(
        { status: result.status, error: result.error },
        { status: 422 }
      );
    }

    if (result.status === "walk_ins_disabled") {
      return NextResponse.json(
        {
          status: result.status,
          student: result.student,
          error: result.error,
        },
        { status: 403 }
      );
    }

    // Success outcomes (success, success_walk_in, pending_confirmation)
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") 
        },
        { status: 400 }
      );
    }
    console.error("Scan POST endpoint error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  // Apply IP Rate Limiter (Max 60 requests per minute)
  const ip = getClientIp(req);
  const limiter = rateLimit(ip, 60, 60000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil((limiter.resetTime - Date.now()) / 1000).toString(),
        }
      }
    );
  }

  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ error: "Search query too short" }, { status: 400 });
    }

    // Delegate query search to ScannerService
    const results = await ScannerService.searchStudents(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Scan GET endpoint error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
