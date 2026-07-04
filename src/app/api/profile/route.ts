import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { FACULTY_IDS } from "@/lib/faculties";

// Emergency contacts are stored as a jsonb array of {name, relationship, phone}.
// Validate the shape instead of accepting z.any() — the onboarding form always
// sends this structure, and a typed schema stops arbitrary/oversized JSON (a jsonb
// bloat vector) from being written straight into the row. Fields are tolerant of
// empty strings because the second contact is optional in the UI.
const emergencyContactSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
});

const profileSchema = z.object({
  name: z.string().min(1),
  nickname: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  faculty: z.enum(FACULTY_IDS as [string, ...string[]]).optional().nullable(),
  major: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  contactChannels: z.string().optional().nullable(),
  chronicDiseases: z.string().optional().nullable(),
  medicalHistory: z.string().optional().nullable(),
  drugAllergies: z.string().optional().nullable(),
  foodAllergies: z.string().optional().nullable(),
  dietaryRestrictions: z.string().optional().nullable(),
  emergencyContacts: z.array(emergencyContactSchema).optional().nullable(),
  faintingHistory: z.boolean().optional().nullable(),
  emergencyMedication: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  studentId: z.string().optional().nullable(), // Allow empty or null for admins
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      // The static qrToken is a long-lived check-in credential — the dashboard
      // gets short-lived signed tokens from /api/qr-token instead, so it must
      // never ride along in profile responses.
      columns: { qrToken: false },
      with: { house: true }
    });

    return NextResponse.json(user);
  } catch (error) {
    // Log a plain message only — never the raw error, whose Postgres `detail` can
    // carry PII (student id, phone) from the failing row.
    console.error("Profile GET error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: Initial Onboarding
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = profileSchema.parse(body);

    const isAdmin = ["super_admin", "admin", "registration", "organizer"].includes(session.user.role || "");
    if (!data.studentId && !isAdmin) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    // 1. Check if user already completed profile
    const existing = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (existing?.profileCompleted) {
       return NextResponse.json({ error: "Profile already completed" }, { status: 400 });
    }

    // 2. Update User. NOTE: house is NO LONGER assigned here — a student is sorted
    // into one of their faculty's colour houses at their FIRST CHECK-IN
    // (ScannerService.ensureHouseAssigned). Onboarding only records their faculty.
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        faculty: data.faculty ?? "CAMT",
        profileCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning();

    revalidatePath("/");
    revalidatePath("/dashboard");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { qrToken: _qrToken, ...safeUser } = updated;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => `${i.path}: ${i.message}`).join(", ") }, { status: 400 });
    }

    // Handle Postgres Unique Constraint Violation (duplicate entries).
    // Deliberately generic: naming the colliding field would let anyone with an
    // account enumerate which student IDs / phone numbers exist in the system.
    const dbError = error instanceof Error && error.cause ? error.cause : error;
    if (dbError && typeof dbError === "object" && "code" in dbError && dbError.code === "23505") {
      return NextResponse.json({ error: "infoAlreadyInUse" }, { status: 400 });
    }

    // Message only — the raw error's Postgres `detail` can carry PII from the row.
    console.error("Profile onboarding error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH: Regular Update
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = profileSchema.parse(body);

    // studentId gates Thai/International event eligibility and is set at onboarding.
    // The UI locks it, but a raw PATCH could still send a new value — strip it here
    // for non-admins so it can never be changed after the fact.
    const isAdmin = ["super_admin", "admin", "registration", "organizer"].includes(session.user.role || "");
    if (!isAdmin) {
      delete data.studentId;
      // Faculty is set once at onboarding and gates which house a student lands in
      // at check-in. Lock it for non-admins so a raw PATCH can't switch faculties.
      delete data.faculty;
    }

    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning();

    revalidatePath("/");
    revalidatePath("/dashboard");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { qrToken: _qrToken, ...safeUser } = updated;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Handle Postgres Unique Constraint Violation (duplicate entries).
    // Deliberately generic: naming the colliding field would let anyone with an
    // account enumerate which student IDs / phone numbers exist in the system.
    const dbError = error instanceof Error && error.cause ? error.cause : error;
    if (dbError && typeof dbError === "object" && "code" in dbError && dbError.code === "23505") {
      return NextResponse.json({ error: "infoAlreadyInUse" }, { status: 400 });
    }

    // Message only — the raw error's Postgres `detail` can carry PII from the row.
    console.error("Profile update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
