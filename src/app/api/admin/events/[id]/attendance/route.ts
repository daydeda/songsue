import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;

    const list = await db.query.attendance.findMany({
      where: eq(attendance.eventId, eventId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            nickname: true,
            studentId: true,
            major: true,
            phone: true,
            chronicDiseases: true,
            medicalHistory: true,
            drugAllergies: true,
            foodAllergies: true,
            dietaryRestrictions: true,
            faintingHistory: true,
            emergencyContacts: true,
          },
          with: {
            house: {
              columns: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
    });

    // FE-12: Log the sensitive data access (Immutable Audit Trail)
    // Since attendance list now contains medical info, we must log this access.
    await db.insert(auditLogs).values({
      actorId: session.user.id,
      action: `Viewed Attendance List for Event ${eventId} (included health info)`,
      timestamp: new Date(),
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1",
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Failed to fetch attendance:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
