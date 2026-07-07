import { auth } from "@/auth";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { normalizeForm, computeScore, type AnswerMap } from "@/lib/form-schema";
import { ASSIGNABLE_ROLES } from "@/lib/form-access";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { revertFormAward } from "@/lib/award-points";
import { revalidateLeaderboards } from "@/lib/leaderboard-cache";

const ADMIN_ROLES = ["super_admin", "admin", "registration", "organizer"];

function isAdmin(role?: string) {
  return ADMIN_ROLES.includes(role || "");
}

// Parse an incoming datetime (ISO string) into a Date, or null. Invalid/empty
// values become null (unbounded on that side of the window).
function parseDateOrNull(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Keep only valid, de-duplicated role strings from the assignable set.
function sanitizeRoles(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const allowed = ASSIGNABLE_ROLES as readonly string[];
  return [...new Set(v.filter((r): r is string => typeof r === "string" && allowed.includes(r)))];
}

// Keep only non-empty string ids, de-duplicated.
function sanitizeUserIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
}

// Bound a form's point award the same way manual house adjustments are capped
// (±10000, see /api/admin/houses/points) so a typo like 1000000 can't swing the
// leaderboard. Non-numeric input falls back to 0 (matches the old `|| 0`).
const MAX_FORM_POINTS = 10000;
function clampPoints(v: unknown): number {
  const n = parseInt(v as string);
  if (Number.isNaN(n)) return 0;
  return Math.max(-MAX_FORM_POINTS, Math.min(MAX_FORM_POINTS, n));
}

// Tolerantly read a JSON request body: a malformed/empty payload yields null so the
// handler can answer 400 instead of letting the bare await throw a 500.
async function readJsonBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// GET /api/admin/events/[id]/form — fetch all forms for this event with stats & submissions
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;

    const allForms = await db.query.forms.findMany({
      where: eq(forms.eventId, eventId),
      with: {
        submissions: {
          with: {
            user: {
              columns: {
                name: true,
                studentId: true,
                houseId: true,
                nickname: true,
                major: true,
                phone: true,
                contactChannels: true,
              },
            },
          },
          orderBy: (s, { desc }) => [desc(s.submittedAt)],
        },
      },
      orderBy: (f, { asc }) => [asc(f.sortOrder), asc(f.createdAt)],
    });

    const result = allForms.map((formObj) => {
      const houseStats: Record<string, number> = { red: 0, green: 0, yellow: 0, blue: 0 };
      for (const sub of formObj.submissions) {
        const hId = sub.user?.houseId;
        if (hId && houseStats[hId] !== undefined) houseStats[hId]++;
      }

      const normalized = normalizeForm(formObj.questions);

      return {
        id: formObj.id,
        eventId: formObj.eventId,
        formType: formObj.formType,
        sortOrder: formObj.sortOrder,
        title: formObj.title,
        description: formObj.description,
        questions: formObj.questions,
        pointsAwarded: formObj.pointsAwarded,
        individualPointsAwarded: formObj.individualPointsAwarded,
        isActive: formObj.isActive,
        isAwarded: formObj.isAwarded,
        opensAt: formObj.opensAt,
        closesAt: formObj.closesAt,
        assignedRoles: formObj.assignedRoles ?? [],
        assignedUserIds: formObj.assignedUserIds ?? [],
        stats: houseStats,
        submissions: formObj.submissions.map((sub) => {
          const { score, maxScore, hasGraded } = computeScore(normalized, (sub.answers as AnswerMap) || {});
          return {
            id: sub.id,
            studentName: sub.user?.name || "Student",
            studentId: sub.user?.studentId || "",
            houseId: sub.user?.houseId || "unassigned",
            nickname: sub.user?.nickname || "",
            major: sub.user?.major || "",
            phone: sub.user?.phone || "",
            contactChannels: sub.user?.contactChannels || "",
            answers: sub.answers,
            submittedAt: sub.submittedAt,
            score,
            maxScore,
            hasGraded,
          };
        }),
      };
    });

    // PDPA: the admin form view returns every submitter's phone + contact channels.
    // Log the PII read (who/when), mirroring the attendance-list access log. Hard
    // (not best-effort): if we can't record the read, we don't serve it.
    const submissionCount = result.reduce((n, f) => n + f.submissions.length, 0);
    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Viewed form submissions for event ${eventId} (${submissionCount} submissions, included submitter phone + contact channels)`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ forms: result });
  } catch (error) {
    console.error("Failed to fetch admin form data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/events/[id]/form — create a new form for the event
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const body = await readJsonBody(req);
    if (body === null) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { title, description, questions, pointsAwarded, individualPointsAwarded, isActive, formType, sortOrder, opensAt, closesAt, assignedRoles, assignedUserIds } = body;

    const isValidQuestions =
      Array.isArray(questions) ||
      (questions && typeof questions === "object" && Array.isArray(questions.sections));

    if (!title || !isValidQuestions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validTypes = ["K_pre", "K_post", "A", "S", "F"];
    if (formType && !validTypes.includes(formType)) {
      return NextResponse.json({ error: "Invalid form_type" }, { status: 400 });
    }

    // "Closes at" is required — it's the trigger that closes the form and
    // auto-awards its points, so a form without it would never resolve.
    const opensAtDate = parseDateOrNull(opensAt);
    const closesAtDate = parseDateOrNull(closesAt);
    if (!closesAtDate) {
      return NextResponse.json({ error: "A valid \"Closes at\" time is required." }, { status: 400 });
    }
    if (opensAtDate && closesAtDate <= opensAtDate) {
      return NextResponse.json({ error: "\"Closes at\" must be after \"Opens at\"." }, { status: 400 });
    }

    const [result] = await db
      .insert(forms)
      .values({
        eventId,
        formType: formType || "K_post",
        sortOrder: sortOrder ?? 0,
        title,
        description: description || "",
        questions,
        pointsAwarded: clampPoints(pointsAwarded),
        individualPointsAwarded: clampPoints(individualPointsAwarded),
        isActive: isActive !== undefined ? !!isActive : true,
        opensAt: opensAtDate,
        closesAt: closesAtDate,
        assignedRoles: sanitizeRoles(assignedRoles),
        assignedUserIds: sanitizeUserIds(assignedUserIds),
      })
      .returning();

    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Created form "${result.title}" (${result.id}) for event ${eventId} with award: ${result.pointsAwarded} house PTS, ${result.individualPointsAwarded} individual PTS`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, form: result });
  } catch (error) {
    console.error("Failed to create event form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/admin/events/[id]/form — update an existing form
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const body = await readJsonBody(req);
    if (body === null) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { formId, title, description, questions, pointsAwarded, individualPointsAwarded, isActive, sortOrder, opensAt, closesAt, assignedRoles, assignedUserIds } = body;

    if (!formId) {
      return NextResponse.json({ error: "formId is required" }, { status: 400 });
    }

    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.eventId, eventId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const isValidQuestions =
      !questions ||
      Array.isArray(questions) ||
      (questions && typeof questions === "object" && Array.isArray(questions.sections));

    if (!isValidQuestions) {
      return NextResponse.json({ error: "Invalid questions format" }, { status: 400 });
    }

    // The effective schedule after this update must still have a valid "Closes at"
    // (it's the auto-close/auto-award trigger), and it must be after "Opens at".
    const effectiveOpensAt = "opensAt" in body ? parseDateOrNull(opensAt) : existing.opensAt;
    const effectiveClosesAt = "closesAt" in body ? parseDateOrNull(closesAt) : existing.closesAt;
    if (!effectiveClosesAt) {
      return NextResponse.json({ error: "A valid \"Closes at\" time is required." }, { status: 400 });
    }
    if (effectiveOpensAt && effectiveClosesAt <= effectiveOpensAt) {
      return NextResponse.json({ error: "\"Closes at\" must be after \"Opens at\"." }, { status: 400 });
    }

    // Re-open: an already-awarded form whose new close time is back in the future
    // will accept entries again, so the points it already handed out must be
    // clawed back (and the form re-armed) — otherwise the next close double-counts.
    const reopening =
      existing.isAwarded && effectiveClosesAt.getTime() > Date.now();

    // Reverting real house points is sensitive — confine it to full admins, even
    // though registration/organizer may otherwise edit a form.
    if (reopening && !["super_admin", "admin"].includes(session.user.role || "")) {
      return NextResponse.json(
        { error: "Only an admin can re-open a form that has already awarded points." },
        { status: 403 }
      );
    }

    const result = await db.transaction(async (tx) => {
      let revertNote = "";
      if (reopening) {
        const reverted = await revertFormAward(tx, formId);
        revertNote = reverted.length
          ? " Reverted award: " +
            reverted.map((r) => `${r.houseId} -${r.points} PTS`).join(", ") +
            "."
          : " No points needed reverting.";
      }

      const [updated] = await tx
        .update(forms)
        .set({
          title: title ?? existing.title,
          description: description ?? existing.description,
          questions: questions ?? existing.questions,
          pointsAwarded: pointsAwarded !== undefined ? clampPoints(pointsAwarded) : existing.pointsAwarded,
          individualPointsAwarded: individualPointsAwarded !== undefined ? clampPoints(individualPointsAwarded) : existing.individualPointsAwarded,
          // A re-open re-arms the form; otherwise honour an explicit isActive.
          isActive: reopening ? true : (isActive !== undefined ? !!isActive : existing.isActive),
          isAwarded: reopening ? false : existing.isAwarded,
          sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
          opensAt: effectiveOpensAt,
          closesAt: effectiveClosesAt,
          assignedRoles: "assignedRoles" in body ? sanitizeRoles(assignedRoles) : existing.assignedRoles,
          assignedUserIds: "assignedUserIds" in body ? sanitizeUserIds(assignedUserIds) : existing.assignedUserIds,
          updatedAt: new Date(),
        })
        .where(and(eq(forms.id, formId), eq(forms.eventId, eventId)))
        .returning();

      await AuditService.logActionInternal(tx, {
        actorId: session.user!.id!,
        action: reopening
          ? `Re-opened awarded form "${updated.title}" (${formId}) for event ${eventId}.${revertNote}`
          : `Updated form "${updated.title}" (${formId}) for event ${eventId}`,
        ipAddress: getClientIp(req),
      });

      return updated;
    });

    // A revert changed house totals — bust the cached leaderboard so it reflects
    // the clawback on the next poll instead of waiting out the 15s window.
    if (reopening) {
      revalidateLeaderboards();
    }

    return NextResponse.json({ success: true, form: result });
  } catch (error) {
    console.error("Failed to update event form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/admin/events/[id]/form — delete a specific form
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const body = await readJsonBody(req);
    if (body === null) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { formId } = body;

    if (!formId) {
      return NextResponse.json({ error: "formId is required" }, { status: 400 });
    }

    const existing = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.eventId, eventId)),
    });

    if (!existing) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (existing.isAwarded) {
      return NextResponse.json({ error: "Cannot delete a form that has already awarded points." }, { status: 400 });
    }

    await db.delete(forms).where(and(eq(forms.id, formId), eq(forms.eventId, eventId)));

    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Deleted form "${existing.title}" (${formId}) from event ${eventId}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
