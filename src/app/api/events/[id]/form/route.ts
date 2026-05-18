import { auth } from "@/auth";
import { db } from "@/db";
import { forms, formSubmissions, attendance } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/events/[id]/form — Fetch the form for students (checking if attended & submitted)
export async function GET(
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

    // 1. Get the form details
    const formObj = await db.query.forms.findFirst({
      where: eq(forms.eventId, eventId),
    });

    if (!formObj) {
      return NextResponse.json({ form: null });
    }

    // 2. Verify if the student checked in / attended this event
    const attRecord = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.eventId, eventId),
        eq(attendance.studentId, userId)
      ),
    });

    const hasAttended = attRecord?.status === "attended";

    // 3. Check if the student has already submitted this form
    const existingSubmission = await db.query.formSubmissions.findFirst({
      where: and(
        eq(formSubmissions.formId, formObj.id),
        eq(formSubmissions.studentId, userId)
      ),
    });

    return NextResponse.json({
      form: {
        id: formObj.id,
        eventId: formObj.eventId,
        title: formObj.title,
        description: formObj.description,
        questions: formObj.questions,
        pointsAwarded: formObj.pointsAwarded,
        isActive: formObj.isActive,
        isAwarded: formObj.isAwarded,
      },
      hasAttended,
      hasSubmitted: !!existingSubmission,
      answers: existingSubmission?.answers || null,
    });
  } catch (error) {
    console.error("Failed to fetch student form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/events/[id]/form — Student submits their evaluation form answers
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
    const { answers } = await req.json();

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Missing or invalid answers" }, { status: 400 });
    }

    // 1. Get the form
    const formObj = await db.query.forms.findFirst({
      where: eq(forms.eventId, eventId),
    });

    if (!formObj) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (formObj.isAwarded) {
      return NextResponse.json({ error: "The contest has finalized and this form is permanently locked." }, { status: 400 });
    }

    if (!formObj.isActive) {
      return NextResponse.json({ error: "This form has been closed by the administrator." }, { status: 400 });
    }

    // 2. Verify attendance
    const attRecord = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.eventId, eventId),
        eq(attendance.studentId, userId)
      ),
    });

    const hasAttended = attRecord?.status === "attended";
    if (!hasAttended) {
      return NextResponse.json({ 
        error: "You must have checked in and physically attended this event to submit an evaluation form." 
      }, { status: 403 });
    }

    // 3. Check for duplicate submissions
    const existingSubmission = await db.query.formSubmissions.findFirst({
      where: and(
        eq(formSubmissions.formId, formObj.id),
        eq(formSubmissions.studentId, userId)
      ),
    });

    if (existingSubmission) {
      return NextResponse.json({ error: "You have already completed the form for this event." }, { status: 400 });
    }

    // 4. Record the submission
    await db.insert(formSubmissions).values({
      formId: formObj.id,
      studentId: userId,
      answers,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to submit student form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
