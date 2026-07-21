// Best-effort, one-directional sync from Songsue into the sibling app ActiveCAMT:
// when a student is checked in via Songsue's own scanner for an event mirrored
// from ActiveCAMT (events.externalSource === 'activecamt'), the attended fact is
// mirrored onto ActiveCAMT's own attendance table too — see
// src/modules/events/scanner.service.ts's syncAttendedToActiveCamt for the call
// site. This is the reverse counterpart to ActiveCAMT's own src/lib/songsue-sync.ts.
//
// NEVER throws — every failure is logged (captureException) and swallowed, so an
// ActiveCAMT outage can never block a real Songsue check-in. There is no retry
// queue in this v1; a failed sync is only visible via the error log.
//
// PDPA: identity fields AND medical/emergency-contact data are both sent — mirrors
// the same tradeoff ActiveCAMT's own songsue-sync.ts already makes in the other
// direction (see activecamt-sync.service.ts's upsertSyncedUser doc comment).
// ActiveCAMT gates each write the same way Songsue does: full identity+medical
// write on brand-new account creation; on an existing ActiveCAMT row, only fields
// still blank there get filled in. Songsue's own PDPA consent is never inherited
// as ActiveCAMT's — ActiveCAMT's pdpaConsent-equivalent starts/stays false until
// the student explicitly consents inside ActiveCAMT itself.
import { captureException } from "@/lib/logger";

export interface ActiveCamtEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface ActiveCamtCheckinSyncPayload {
  // ActiveCAMT's own real event id (Songsue's mirrored event.externalId).
  eventId: string;
  user: {
    email: string;
    studentId?: string | null;
    name: string;
    prefix?: string | null;
    faculty?: string | null;
    major?: string | null;
    phone?: string | null;
    nickname?: string | null;
    image?: string | null;
    religion?: string | null;
    contactChannels?: string | null;
    chronicDiseases?: string | null;
    medicalHistory?: string | null;
    drugAllergies?: string | null;
    foodAllergies?: string | null;
    dietaryRestrictions?: string | null;
    faintingHistory?: boolean | null;
    emergencyMedication?: string | null;
    emergencyContacts?: ActiveCamtEmergencyContact[] | null;
  };
  status: "attended";
}

function activeCamtSyncConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = process.env.ACTIVECAMT_SYNC_URL;
  const secret = process.env.ACTIVECAMT_SYNC_SECRET;
  if (!baseUrl || !secret) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), secret };
}

async function postSync(path: string, body: unknown): Promise<void> {
  const config = activeCamtSyncConfig();
  if (!config) {
    // Not configured (e.g. local dev without an ActiveCAMT instance) — silently
    // skip rather than spamming the error log on every scan.
    return;
  }

  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.secret}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      captureException(new Error(`ActiveCAMT sync failed: ${path} -> ${res.status} ${text}`), {
        activeCamtSyncPath: path,
      });
    }
  } catch (error) {
    captureException(error, { activeCamtSyncPath: path });
  }
}

// Called after a confirmed check-in commits (scanner.service.ts) for an event
// mirrored from ActiveCAMT (externalSource === 'activecamt').
export async function syncAttendedToActiveCamt(payload: ActiveCamtCheckinSyncPayload): Promise<void> {
  await postSync("/api/integrations/songsue/checkin", payload);
}
