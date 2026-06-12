import { auth } from "@/auth";
import { db } from "@/db";
import { forms, formSubmissions, attendance } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  normalizeForm,
  computeScore,
  getVisitedSectionIndices,
  isQuestionVisible,
  type AnswerMap,
} from "@/lib/form-schema";
import { canAccessSkillForm, getFormAvailability } from "@/lib/form-access";

// GET /api/events/[id]/form — fetch all relevant forms for a student
// S-type forms are excluded for non-admin users.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const userId = session.user.id!;
    const userRole = session.user.role || "";

    const attRecord = await db.query.attendance.findFirst({
      where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, userId)),
    });
    const hasAttended = attRecord?.status === "attended";

    const allForms = await db.query.forms.findMany({
      where: eq(forms.eventId, eventId),
      orderBy: (f, { asc }) => [asc(f.sortOrder), asc(f.createdAt)],
    });

    // S forms are gated by assignment (role/person + managers); other forms are
    // visible to everyone.
    const viewer = { id: userId, role: userRole };
    const visibleForms = allForms.filter((f) => f.formType !== "S" || canAccessSkillForm(f, viewer));

    const formResponses = await Promise.all(
      visibleForms.map(async (formObj) => {
        const existingSubmission = await db.query.formSubmissions.findFirst({
          where: and(
            eq(formSubmissions.formId, formObj.id),
            eq(formSubmissions.studentId, userId)
          ),
        });

        let result: { score: number; maxScore: number; hasGraded: boolean } | null = null;
        if (existingSubmission) {
          const { score, maxScore, hasGraded } = computeScore(
            normalizeForm(formObj.questions),
            (existingSubmission.answers as AnswerMap) || {}
          );
          if (hasGraded) result = { score, maxScore, hasGraded };
        }

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
          availability: getFormAvailability(formObj),
          hasSubmitted: !!existingSubmission,
          answers: existingSubmission?.answers || null,
          result,
        };
      })
    );

    return NextResponse.json({ forms: formResponses, hasAttended });
  } catch (error) {
    console.error("Failed to fetch student forms:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/events/[id]/form — student submits answers to a specific form
// Body: { formId: string, answers: AnswerMap }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const userId = session.user.id!;
    const userRole = session.user.role || "";
    const { formId, answers } = await req.json();

    if (!formId) {
      return NextResponse.json({ error: "formId is required" }, { status: 400 });
    }
    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Missing or invalid answers" }, { status: 400 });
    }

    const formObj = await db.query.forms.findFirst({
      where: and(eq(forms.id, formId), eq(forms.eventId, eventId)),
    });

    if (!formObj) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // S forms are restricted to assigned people (by role/person) + managers.
    if (formObj.formType === "S" && !canAccessSkillForm(formObj, { id: userId, role: userRole })) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    // Schedule-aware gate: finalized (awarded), not yet open, or past close.
    const availability = getFormAvailability(formObj);
    if (availability === "awarded") {
      return NextResponse.json({ error: "The contest has finalized and this form is permanently locked." }, { status: 400 });
    }
    if (availability === "upcoming") {
      return NextResponse.json({ error: "This form is not open yet. Please come back when it opens." }, { status: 400 });
    }
    if (availability !== "open") {
      return NextResponse.json({ error: "This form is closed." }, { status: 400 });
    }

    // K_pre (pre-test) and S (skill — filled by assigned evaluators, not attendees)
    // skip the attendance check; all others require physical check-in.
    if (formObj.formType !== "K_pre" && formObj.formType !== "S") {
      const attRecord = await db.query.attendance.findFirst({
        where: and(eq(attendance.eventId, eventId), eq(attendance.studentId, userId)),
      });
      if (attRecord?.status !== "attended") {
        return NextResponse.json({
          error: "You must have checked in and physically attended this event to submit this form.",
        }, { status: 403 });
      }
    }

    const existingSubmission = await db.query.formSubmissions.findFirst({
      where: and(eq(formSubmissions.formId, formObj.id), eq(formSubmissions.studentId, userId)),
    });
    if (existingSubmission) {
      return NextResponse.json({ error: "You have already completed this form." }, { status: 400 });
    }

    // 3b. Server-side required-field validation. The client enforces this too, but a
    // raw POST could send {} and still count toward the house submission contest.
    // Only validate questions actually on the student's branch path and visible.
    const normalized = normalizeForm(formObj.questions);
    const answerMap = answers as AnswerMap;
    const isBlank = (v: unknown) =>
      v === undefined || v === null ||
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);

    for (const idx of getVisitedSectionIndices(normalized, answerMap)) {
      for (const q of normalized.sections[idx].questions) {
        if (q.required && isQuestionVisible(q, answerMap) && isBlank(answerMap[q.id])) {
          return NextResponse.json(
            { error: "Please answer all required questions before submitting." },
            { status: 400 }
          );
        }
      }
    }

    // 4. Record the submission. The (form_id, student_id) unique index is the
    // authoritative guard against a double-submit race slipping past the check above.
    try {
      await db.insert(formSubmissions).values({ formId: formObj.id, studentId: userId, answers });
    } catch (e) {
      const dbError = (e as { cause?: { code?: string }; code?: string })?.cause ?? (e as { code?: string });
      if (dbError?.code === "23505") {
        return NextResponse.json({ error: "You have already completed this form." }, { status: 409 });
      }
      throw e;
    }

    const { score, maxScore, hasGraded } = computeScore(normalizeForm(formObj.questions), answers as AnswerMap);

    return NextResponse.json({
      success: true,
      result: hasGraded ? { score, maxScore, hasGraded } : null,
    });
  } catch (error) {
    console.error("Failed to submit student form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
