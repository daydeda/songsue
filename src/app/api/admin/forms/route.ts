import { auth } from "@/auth";
import { db } from "@/db";
import { forms, auditLogs } from "@/db/schema";
import { desc, eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const formCreateSchema = z.object({
  eventId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  pointsAwarded: z.number().int().min(0).optional(),
  questions: z.array(z.object({
    id: z.string(),
    type: z.enum(["text", "rating"]),
    label: z.string().min(1),
    required: z.boolean()
  }))
});

// GET /api/admin/forms — List all forms with submission counts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const list = await db.query.forms.findMany({
      orderBy: [desc(forms.createdAt)],
      with: {
        submissions: {
          columns: {
            id: true
          }
        }
      }
    });

    const enriched = list.map(f => ({
      id: f.id,
      eventId: f.eventId,
      title: f.title,
      description: f.description,
      pointsAwarded: f.pointsAwarded,
      questions: f.questions,
      isActive: f.isActive,
      submissionCount: f.submissions?.length ?? 0,
      createdAt: f.createdAt
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch admin forms:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/admin/forms — Create a new custom form
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = formCreateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", details: result.error.format() }, { status: 400 });
    }

    const { eventId, title, description, pointsAwarded, questions } = result.data;

    const [newForm] = await db.insert(forms).values({
      eventId,
      title,
      description,
      pointsAwarded: pointsAwarded ?? 0,
      questions: questions,
      isActive: true
    }).returning();

    // Log audit log
    await db.insert(auditLogs).values({
      actorId: session.user.id,
      action: `Created new custom form: "${title}" (ID: ${newForm.id}) with award: ${pointsAwarded} PTS`,
      timestamp: new Date(),
      ipAddress: 
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1",
    });

    return NextResponse.json(newForm);
  } catch (error) {
    console.error("Failed to create admin form:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
