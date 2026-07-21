import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthorizedActiveCamtSync } from "@/lib/integration-auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { ActiveCamtSyncService, ActiveCamtSyncError } from "@/modules/integrations/activecamt-sync.service";

export const dynamic = "force-dynamic";

// Mirrors emergencyContactSchema in api/profile/route.ts.
const emergencyContactSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
});

const registerSyncSchema = z.object({
  externalEventId: z.string().min(1),
  user: z.object({
    // Lowercased to match auth.ts's normalization (src/auth.ts:129/248) — a
    // mismatched case would miss the existing row on email lookup and create
    // a duplicate/phantom account instead of syncing onto the real one.
    email: z.string().email().transform((e) => e.toLowerCase()),
    studentId: z.string().optional().nullable(),
    name: z.string().min(1),
    prefix: z.string().optional().nullable(),
    faculty: z.string().optional().nullable(),
    major: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    nickname: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    religion: z.string().optional().nullable(),
    contactChannels: z.string().optional().nullable(),
    // Sensitive — only written on first-time account creation, and only ever
    // sourced from ActiveCAMT's own consent, not songsue's (see
    // SyncExternalRegistrationUser's doc comment in activecamt-sync.service.ts).
    chronicDiseases: z.string().optional().nullable(),
    medicalHistory: z.string().optional().nullable(),
    drugAllergies: z.string().optional().nullable(),
    foodAllergies: z.string().optional().nullable(),
    dietaryRestrictions: z.string().optional().nullable(),
    faintingHistory: z.boolean().optional().nullable(),
    emergencyMedication: z.string().optional().nullable(),
    emergencyContacts: z.array(emergencyContactSchema).optional().nullable(),
  }),
  status: z.enum(["registered", "attended", "cancelled"]),
});

// POST /api/integrations/activecamt/register — ActiveCAMT calls this after a
// student registers, unregisters, or gets checked in (QR scan) for an event
// flagged `songsueLinked`. Upserts the student's Songsue account by email
// (profileCompleted/pdpaConsent/houseId stay unset, but profile AND medical/
// emergency fields from the payload ARE written on first-time creation — a
// deliberate PDPA-consent tradeoff, see SyncExternalRegistrationUser's doc
// comment in activecamt-sync.service.ts) and mirrors their attendance status
// onto the previously synced event — see
// ActiveCamtSyncService.syncExternalRegistration. 404s if the event hasn't
// been synced via POST .../events yet.
export async function POST(req: Request) {
  if (!isAuthorizedActiveCamtSync(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defense-in-depth beyond the shared secret — mirrors the scanner route's own
  // limiter (src/app/api/admin/scan/route.ts): a single check-in on the
  // ActiveCAMT side can fire register + attended in quick succession per student.
  const ip = getClientIp(req);
  const limiter = await rateLimit(ip, 300, 60000);
  if (!limiter.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const data = registerSyncSchema.parse(body);

    const result = await ActiveCamtSyncService.syncExternalRegistration(data, ip);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    if (error instanceof ActiveCamtSyncError && error.message === "EXTERNAL_EVENT_NOT_SYNCED") {
      return NextResponse.json({ error: "Event has not been synced from ActiveCAMT yet" }, { status: 404 });
    }
    if (error instanceof ActiveCamtSyncError && error.message === "EXTERNAL_EVENT_HAS_NO_SESSION") {
      return NextResponse.json({ error: "Synced event has no session to attach attendance to" }, { status: 409 });
    }
    console.error("ActiveCAMT registration sync error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
