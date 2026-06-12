import { auth } from "@/auth";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { normalizeForm, computeScore, type AnswerMap } from "@/lib/form-schema";
import { ASSIGNABLE_ROLES } from "@/lib/form-access";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";

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

// GET /api/admin/events/[id]/form — fetch all forms for this event with stats & submissions
export async function GET(
  _req: Request,
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
            user: { columns: { name: true, studentId: true, houseId: true } },
          },
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
            answers: sub.answers,
            submittedAt: sub.submittedAt,
            score,
            maxScore,
            hasGraded,
          };
        }),
      };
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
    const { title, description, questions, pointsAwarded, isActive, formType, sortOrder, opensAt, closesAt, assignedRoles, assignedUserIds } = await req.json();

    const isValidQuestions =
      Array.isArray(questions) ||
      (questions && typeof questions === "object" && Array.isArray(questions.sections));

    if (!title || !isValidQuestions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const validTypes = ["K_pre", "K_post", "A", "S"];
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
        pointsAwarded: parseInt(pointsAwarded) || 0,
        isActive: isActive !== undefined ? !!isActive : true,
        opensAt: opensAtDate,
        closesAt: closesAtDate,
        assignedRoles: sanitizeRoles(assignedRoles),
        assignedUserIds: sanitizeUserIds(assignedUserIds),
      })
      .returning();

    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Created form "${result.title}" (${result.id}) for event ${eventId} with award: ${result.pointsAwarded} PTS`,
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
    const body = await req.json();
    const { formId, title, description, questions, pointsAwarded, isActive, sortOrder, opensAt, closesAt, assignedRoles, assignedUserIds } = body;

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

    const [result] = await db
      .update(forms)
      .set({
        title: title ?? existing.title,
        description: description ?? existing.description,
        questions: questions ?? existing.questions,
        pointsAwarded: pointsAwarded !== undefined ? parseInt(pointsAwarded) || 0 : existing.pointsAwarded,
        isActive: isActive !== undefined ? !!isActive : existing.isActive,
        sortOrder: sortOrder !== undefined ? sortOrder : existing.sortOrder,
        opensAt: effectiveOpensAt,
        closesAt: effectiveClosesAt,
        assignedRoles: "assignedRoles" in body ? sanitizeRoles(assignedRoles) : existing.assignedRoles,
        assignedUserIds: "assignedUserIds" in body ? sanitizeUserIds(assignedUserIds) : existing.assignedUserIds,
        updatedAt: new Date(),
      })
      .where(and(eq(forms.id, formId), eq(forms.eventId, eventId)))
      .returning();

    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Updated form "${result.title}" (${formId}) for event ${eventId}`,
      ipAddress: getClientIp(req),
    });

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
    const { formId } = await req.json();

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
