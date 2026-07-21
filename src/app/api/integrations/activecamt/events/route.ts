import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedActiveCamtSync } from "@/lib/integration-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { ActiveCamtSyncService } from "@/modules/integrations/activecamt-sync.service";

export const dynamic = "force-dynamic";

const eventSyncSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startTime: z.string(),
  endTime: z.string(),
  location: z.string().optional().nullable(),
  pointsAwarded: z.number().int().min(0).max(10000).optional().nullable(),
  individualPointsAwarded: z.number().int().min(0).max(10000).optional().nullable(),
}).refine((d) => !Number.isNaN(new Date(d.startTime).getTime()), {
  message: "startTime must be a valid date",
  path: ["startTime"],
}).refine((d) => !Number.isNaN(new Date(d.endTime).getTime()), {
  message: "endTime must be a valid date",
  path: ["endTime"],
}).refine((d) => new Date(d.endTime) > new Date(d.startTime), {
  message: "endTime must be after startTime",
  path: ["endTime"],
});

// POST /api/integrations/activecamt/events — ActiveCAMT calls this on create
// AND update of an event flagged `songsueLinked`, mirroring event metadata
// into Songsue's own `events` table so its house-points system can later
// credit the right house. Upserts by (externalSource:'activecamt', externalId)
// — see ActiveCamtSyncService.upsertExternalEvent. Never touches
// winnerAwardedAt (Songsue's own award-cron bookkeeping).
export async function POST(req: Request) {
  if (!isAuthorizedActiveCamtSync(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defense-in-depth beyond the shared secret: even a trusted caller shouldn't
  // be able to hammer this with an unbounded event-upsert loop.
  const ip = getClientIp(req);
  const limiter = await rateLimit(ip, 60, 60000);
  if (!limiter.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const data = eventSyncSchema.parse(body);

    const result = await ActiveCamtSyncService.upsertExternalEvent(data, ip);
    return NextResponse.json({ success: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    console.error("ActiveCAMT event sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
