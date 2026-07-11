import { auth } from "@/auth";
import { db } from "@/db";
import { eventProposals } from "@/db/schema";
import { effectiveRoles } from "@/lib/admin-access";
import { REVIEW_PROPOSAL_ROLES, SUBMIT_PROPOSAL_ROLES } from "@/lib/event-proposals";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { ClubsService } from "@/modules/clubs/clubs.service";
import { EventProposalsService } from "@/modules/events/event-proposals.service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { bangkokDateKey } from "@/lib/event-schema";

export const dynamic = "force-dynamic";

const proposalCreateSchema = z
  .object({
    clubId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    registrationOpenTime: z.string().datetime().optional().nullable(),
    registrationCloseTime: z.string().datetime().optional().nullable(),
    location: z.string().trim().max(200).optional().nullable(),
    quota: z.number().int().min(0).optional().nullable(),
    imageUrl: z.string().optional().nullable(),
    imageUrls: z.array(z.string()).optional().nullable(),
    walkInsEnabled: z.boolean().optional(),
    walkInsOnly: z.boolean().optional(),
    quotaWalkIn: z.number().int().min(0).optional().nullable(),
    registrationMode: z.enum(["once", "per_session"]).optional(),
    // Suggested multi-day schedule — see eventProposals.sessions in schema.ts.
    // No `id` field (unlike sessionInputSchema): these are always brand new
    // suggestions, never edits of existing eventSessions rows.
    sessions: z
      .array(
        z.object({
          title: z.string().trim().max(200).optional().nullable(),
          startTime: z.string().datetime(),
          endTime: z.string().datetime(),
        })
      )
      .optional()
      .nullable(),
    targetThai: z.boolean().optional(),
    targetInternational: z.boolean().optional(),
    quotaThai: z.number().int().min(0).optional().nullable(),
    quotaInternational: z.number().int().min(0).optional().nullable(),
    firstYearOnly: z.boolean().optional(),
    // Suggested only — must be members of the SAME clubId, re-verified
    // server-side below (never trust the client-sent id list alone).
    staffUserIds: z.array(z.string()).optional().nullable(),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  })
  .refine(
    (d) => {
      // Mirrors eventSchema (see /api/admin/events): once `sessions` is
      // populated it holds EVERY day of the schedule (not just extras beyond
      // day 1), and startTime/endTime becomes the overall display range — so
      // it may legitimately span several days once sessions exist. Only each
      // individual session must start and end on the same calendar day.
      if (d.sessions && d.sessions.length > 0) {
        return d.sessions.every((s) => bangkokDateKey(s.startTime) === bangkokDateKey(s.endTime));
      }
      return bangkokDateKey(d.startTime) === bangkokDateKey(d.endTime);
    },
    {
      message: "Each day must start and end on the same calendar day — add each additional day as its own row instead of stretching one day across several dates",
      path: ["endTime"],
    },
  );

// GET /api/admin/event-proposals — list proposals. Staff (REVIEW_PROPOSAL_ROLES)
// see every proposal, optionally filtered by ?status=. A club_president sees
// only proposals for clubs they preside over (scoped via
// EventScopeService.getPresidentScope, same scope object events/appeals use —
// never trust a client-sent clubId). No pagination for v1, mirroring the
// existing /api/admin/appeals precedent at this data volume.
export async function GET(req: Request) {
  try {
    const session = await auth();
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    const isStaff = myRoles.some((r) => (REVIEW_PROPOSAL_ROLES as readonly string[]).includes(r));
    const isPresident = myRoles.some((r) => (SUBMIT_PROPOSAL_ROLES as readonly string[]).includes(r));
    if (!session?.user || (!isStaff && !isPresident)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const proposals = await EventProposalsService.listForViewer(session.user.id!, myRoles, isStaff, status);
    return NextResponse.json(proposals);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/event-proposals — a club_president requests an event for a
// club they preside over. All requested fields (title/time/location/quota/
// audience/poster/staff/etc.) are non-binding suggestions: staff still
// explicitly sets pointsAwarded/allowedRoles/allowedMajors/managedByRoles/
// ownerClubIds when creating the real event (see POST /api/admin/events'
// proposalId linkage) — nothing sensitive becomes self-service here, and the
// suggested staffUserIds can only be drawn from the proposer's own club
// roster (never the global student directory).
export async function POST(req: Request) {
  try {
    const session = await auth();
    const myRoles = effectiveRoles(session?.user?.role, session?.user?.roles);
    if (!session?.user || !myRoles.some((r) => (SUBMIT_PROPOSAL_ROLES as readonly string[]).includes(r))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = proposalCreateSchema.parse(await req.json());

    // Never trust a client-sent clubId — it must be a club this president
    // actually presides over.
    const inScope = await EventProposalsService.isClubInScope(session.user.id!, myRoles, data.clubId);
    if (!inScope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const club = await EventProposalsService.getClub(data.clubId);
    if (!club) {
      return NextResponse.json({ error: "Club not found" }, { status: 404 });
    }
    if (club.isArchived) {
      return NextResponse.json({ error: "This club has been archived" }, { status: 400 });
    }

    // Never trust the client-sent staffUserIds — strip anyone who isn't
    // actually a member of THIS club (the only roster the proposer can see).
    let staffUserIds: string[] | null = null;
    if (data.staffUserIds && data.staffUserIds.length > 0) {
      const members = await ClubsService.getClubMembers(data.clubId);
      const memberIds = new Set(members.map((m) => m.userId));
      const filtered = data.staffUserIds.filter((id) => memberIds.has(id));
      staffUserIds = filtered.length > 0 ? filtered : null;
    }

    const ip = getClientIp(req);
    const created = await db.transaction(async (tx) => {
      const [proposal] = await tx
        .insert(eventProposals)
        .values({
          clubId: data.clubId,
          proposedBy: session.user!.id!,
          title: data.title,
          description: data.description,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          registrationOpenTime: data.registrationOpenTime ? new Date(data.registrationOpenTime) : null,
          registrationCloseTime: data.registrationCloseTime ? new Date(data.registrationCloseTime) : null,
          location: data.location,
          quota: data.quota,
          imageUrl: data.imageUrls?.[0] ?? data.imageUrl ?? null,
          imageUrls: data.imageUrls ?? (data.imageUrl ? [data.imageUrl] : null),
          walkInsEnabled: data.walkInsOnly ? true : (data.walkInsEnabled ?? false),
          walkInsOnly: data.walkInsOnly ?? false,
          quotaWalkIn: data.quotaWalkIn,
          registrationMode: data.registrationMode ?? "once",
          sessions: data.sessions && data.sessions.length > 0
            ? data.sessions.map((s) => ({ title: s.title?.trim() || null, startTime: s.startTime, endTime: s.endTime }))
            : null,
          targetThai: data.targetThai ?? true,
          targetInternational: data.targetInternational ?? true,
          quotaThai: data.quotaThai,
          quotaInternational: data.quotaInternational,
          firstYearOnly: data.firstYearOnly ?? false,
          staffUserIds,
        })
        .returning();

      await AuditService.logActionInternal(tx, {
        actorId: session.user!.id!,
        action: `Submitted event proposal "${proposal.title}" for club ${data.clubId}`,
        ipAddress: ip,
      });

      return proposal;
    });

    return NextResponse.json({ success: true, proposal: created }, { status: 201 });
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
