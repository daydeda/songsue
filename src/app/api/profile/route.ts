import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const profileSchema = z.object({
  name: z.string().min(1),
  nickname: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  major: z.string().optional().nullable(),
  prefix: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  contactChannels: z.string().optional().nullable(),
  chronicDiseases: z.string().optional().nullable(),
  medicalHistory: z.string().optional().nullable(),
  drugAllergies: z.string().optional().nullable(),
  foodAllergies: z.string().optional().nullable(),
  dietaryRestrictions: z.string().optional().nullable(),
  emergencyContacts: z.any().optional().nullable(),
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
      with: { house: true }
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error(error);
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

    const isAdmin = session.user.role === "admin";
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

    // 2. BALANCED HOUSE ASSIGNMENT (FE-03)
    // Find the house with the minimum number of members
    const housesList = await db.query.houses.findMany({
      with: { users: { columns: { id: true } } }
    });

    // Sort by user count
    const sortedHouses = housesList.sort((a, b) => a.users.length - b.users.length);
    const targetHouse = sortedHouses[0]; // House with the fewest people

    // 3. Update User
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        houseId: targetHouse.id,
        profileCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning();

    revalidatePath("/");
    revalidatePath("/dashboard");

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => `${i.path}: ${i.message}`).join(", ") }, { status: 400 });
    }
    console.error(error);
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

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
