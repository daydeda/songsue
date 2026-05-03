import { auth } from "@/auth";
import { db } from "@/db";
import { houses, users } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";

const profileSchema = z.object({
  studentId: z.string().min(9).max(9),
  prefix: z.string().min(1),
  name: z.string().min(1),
  nickname: z.string().min(1),
  major: z.enum(["ANI", "DG", "DII", "MMIT", "SE"]),
  religion: z.string().min(1),
  phone: z.string().min(9),
  contactChannels: z.string(),
  chronicDiseases: z.string(),
  medicalHistory: z.string(),
  drugAllergies: z.string(),
  foodAllergies: z.string(),
  dietaryRestrictions: z.string(),
  faintingHistory: z.boolean(),
  pdpaConsent: z.literal(true, {
    message: "You must accept the PDPA consent to continue.",
  }),
  emergencyContacts: z
    .array(
      z.object({
        name: z.string().min(1),
        relationship: z.string().min(1),
        phone: z.string().min(9),
      })
    )
    .length(2),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = profileSchema.parse(body);

    // FE-03: Balanced Dynamic House Assignment via Atomic DB Transaction
    // This prevents race conditions during concurrent registrations.
    const result = await db.transaction(async (tx) => {
      const currentUser = await tx.query.users.findFirst({
        where: eq(users.id, session.user.id!),
      });

      if (currentUser?.profileCompleted) {
        throw new Error("PROFILE_ALREADY_COMPLETED");
      }

      // Generate a secure QR token (FE-13)
      const qrToken = randomUUID();

      // Find the house with the fewest members (lowest count wins)
      // Using a subquery with COUNT for atomicity within the transaction
      const houseCountResult = await tx
        .select({
          id: houses.id,
          memberCount: sql<number>`COUNT(${users.id})`,
        })
        .from(houses)
        .leftJoin(users, eq(users.houseId, houses.id))
        .groupBy(houses.id)
        .orderBy(asc(sql`COUNT(${users.id})`))
        .limit(1);

      if (!houseCountResult || houseCountResult.length === 0) {
        throw new Error("NO_HOUSES_FOUND");
      }

      const assignedHouseId = houseCountResult[0].id;

      // Update user profile atomically within the transaction
      await tx
        .update(users)
        .set({
          studentId: data.studentId,
          prefix: data.prefix,
          name: data.name,
          nickname: data.nickname,
          major: data.major,
          religion: data.religion,
          phone: data.phone,
          contactChannels: data.contactChannels,
          chronicDiseases: data.chronicDiseases,
          medicalHistory: data.medicalHistory,
          drugAllergies: data.drugAllergies,
          foodAllergies: data.foodAllergies,
          dietaryRestrictions: data.dietaryRestrictions,
          faintingHistory: data.faintingHistory,
          emergencyContacts: data.emergencyContacts,
          pdpaConsent: !!data.pdpaConsent,
          houseId: assignedHouseId,
          qrToken,
          profileCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id!));

      return { houseId: assignedHouseId, qrToken };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof Error) {
      if (error.message === "PROFILE_ALREADY_COMPLETED") {
        return NextResponse.json({ error: "Profile already completed" }, { status: 400 });
      }
      if (error.message === "NO_HOUSES_FOUND") {
        return NextResponse.json(
          { error: "No houses configured. Contact an administrator." },
          { status: 503 }
        );
      }
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
