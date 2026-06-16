import { auth } from "@/auth";
import { db } from "@/db";
import { attendance } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { csvCell } from "@/lib/csv";
import { AuditService } from "@/modules/audit/audit.service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const isAdminRole = ["super_admin", "admin", "registration", "organizer", "smo", "club_president", "major_president"].includes(session?.user?.role || "");
    if (!session?.user || !isAdminRole) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: eventId } = await params;

    const allAttendance = await db.query.attendance.findMany({
      where: eq(attendance.eventId, eventId),
      with: { user: true },
    });

    // Stats
    const preRegisteredRecords = allAttendance.filter(a => a.method === 'pre-registered');
    const totalPreRegistered = preRegisteredRecords.length;
    const attendedPreRegistered = preRegisteredRecords.filter(a => a.status === 'attended').length;
    
    const totalWalkIns = allAttendance.filter(a => a.method === 'walk-in').length;
    const noShows = totalPreRegistered - attendedPreRegistered;
    const noShowPercentage = totalPreRegistered > 0 ? (noShows / totalPreRegistered) * 100 : 0;

    // Bulk PII export: keep a tamper-evident record of who pulled it (PDPA).
    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Exported attendance report CSV for event ${eventId} (${allAttendance.length} rows)`,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1",
    });

    // CSV Construction
    const headers = ["Student ID", "Name", "Nickname", "Method", "Status", "Check-in Time"];
    const rows = allAttendance.map(a => [
      csvCell(a.user.studentId || "N/A"),
      csvCell(a.user.name),
      csvCell(a.user.nickname || ""),
      csvCell(a.method),
      csvCell(a.status),
      csvCell(a.checkInTime ? a.checkInTime.toLocaleString("en-GB", { timeZone: "Asia/Bangkok" }) : "")
    ]);

    const summaryHeaders = ["Metric", "Value"];
    const summaryRows = [
      ["Total Pre-registrations", totalPreRegistered],
      ["Actual Attended (Pre-registered)", attendedPreRegistered],
      ["Total Walk-ins", totalWalkIns],
      ["No-shows", noShows],
      ["No-show Percentage", `${noShowPercentage.toFixed(2)}%`]
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(",")),
      "",
      summaryHeaders.join(","),
      ...summaryRows.map(r => r.join(","))
    ].join("\n");

    const csvWithBom = "\ufeff" + csvContent;

    return new Response(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="event-report-${eventId}.csv"`,
      },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
