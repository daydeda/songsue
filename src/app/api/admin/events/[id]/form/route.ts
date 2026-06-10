import { auth } from "@/auth";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// GET /api/admin/events/[id]/form — Fetch the custom form and submission stats
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;

    const formObj = await db.query.forms.findFirst({
      where: eq(forms.eventId, eventId),
      with: {
        submissions: {
          with: {
            user: {
              columns: {
                name: true,
                studentId: true,
                houseId: true,
              },
            },
          },
        },
      },
    });

    if (!formObj) {
      return NextResponse.json({ form: null, stats: null });
    }

    // Calculate real-time submissions count per house
    const houseStats: Record<string, number> = {
      red: 0,
      green: 0,
      yellow: 0,
      blue: 0,
    };

    for (const sub of formObj.submissions) {
      const houseId = sub.user?.houseId;
      if (houseId && houseStats[houseId] !== undefined) {
        houseStats[houseId]++;
      }
    }

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
      stats: houseStats,
      submissions: formObj.submissions.map((sub) => ({
        id: sub.id,
        studentName: sub.user?.name || "Student",
        studentId: sub.user?.studentId || "",
        houseId: sub.user?.houseId || "unassigned",
        answers: sub.answers,
        submittedAt: sub.submittedAt,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch admin form data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/events/[id]/form — Create or update form for the event
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;
    const { title, description, questions, pointsAwarded, isActive } = await req.json();

    // `questions` is stored as jsonb and may be either a legacy flat array or the
    // v2 section model ({ version, sections: [...] }). Accept both.
    const isValidQuestions =
      Array.isArray(questions) ||
      (questions && typeof questions === "object" && Array.isArray(questions.sections));

    if (!title || !isValidQuestions) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if form already exists
    const existing = await db.query.forms.findFirst({
      where: eq(forms.eventId, eventId),
    });

    let result;
    if (existing) {
      // Update form
      [result] = await db
        .update(forms)
        .set({
          title,
          description: description || "",
          questions,
          pointsAwarded: parseInt(pointsAwarded) || 0,
          isActive: isActive !== undefined ? !!isActive : existing.isActive,
          updatedAt: new Date(),
        })
        .where(eq(forms.eventId, eventId))
        .returning();
    } else {
      // Create new form
      [result] = await db
        .insert(forms)
        .values({
          eventId,
          title,
          description: description || "",
          questions,
          pointsAwarded: parseInt(pointsAwarded) || 0,
          isActive: isActive !== undefined ? !!isActive : true,
        })
        .returning();
    }

    return NextResponse.json({ success: true, form: result });
  } catch (error) {
    console.error("Failed to save custom event form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
