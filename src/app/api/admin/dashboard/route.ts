import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, houses, users } from "@/db/schema";
import { count, gte } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = new URL(req.url).searchParams.get("type") || "overview";

    if (type === "csv") {
      // FE-11: CSV Export
      const allAtt = await db.query.attendance.findMany({
        with: {
          user: { columns: { studentId: true, name: true, major: true } },
          event: { columns: { title: true } },
        },
        orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
      });

      let csv = "Event_Title,Student_ID,Name,Major,Check_In_Time,Method\n";
      allAtt.forEach((a) => {
        csv += `"${a.event?.title ?? ""}","${a.user?.studentId ?? ""}","${a.user?.name ?? ""}","${a.user?.major ?? ""}","${a.checkInTime ?? ""}","${a.method ?? ""}"\n`;
      });

      const csvWithBom = "\ufeff" + csv;

      return new NextResponse(csvWithBom, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activecamt_attendance_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Default: Overview stats
    const [{ count: totalUsers }] = await db.select({ count: count() }).from(users);
    const [{ count: totalEvents }] = await db.select({ count: count() }).from(events);

    // FE-08: Check-ins today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [{ count: checkinsToday }] = await db
      .select({ count: count() })
      .from(attendance)
      .where(gte(attendance.checkInTime, startOfToday));

    const houseList = await db.query.houses.findMany({
      columns: { id: true, name: true, points: true, color: true },
      with: { users: { columns: { id: true } } },
    });

    const recentCheckins = await db.query.attendance.findMany({
      limit: 10,
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
      with: {
        user: { columns: { name: true, nickname: true } },
        event: { columns: { title: true } },
      },
    });

    const recentScores = await db.query.scoreHistory.findMany({
      limit: 10,
      orderBy: (scoreHistory, { desc }) => [desc(scoreHistory.timestamp)],
      columns: {
        delta: true,
        reason: true,
        timestamp: true,
      },
      with: {
        house: { columns: { name: true, color: true } },
      },
    });

    // Merge and sort
    const mergedActivity = [
      ...recentCheckins.map(a => ({
        type: "checkin" as const,
        studentName: a.user?.name ?? "Unknown",
        studentNickname: a.user?.nickname ?? "",
        eventTitle: a.event?.title ?? "Unknown Event",
        timestamp: a.checkInTime?.toISOString() || new Date().toISOString(),
      })),
      ...recentScores.map(s => ({
        type: "score" as const,
        houseName: s.house?.name ?? "Unknown",
        houseColor: s.house?.color ?? "var(--accent-primary)",
        delta: s.delta,
        reason: s.reason,
        timestamp: s.timestamp?.toISOString() || new Date().toISOString(),
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

    return NextResponse.json({
      totalUsers,
      totalEvents,
      checkinsToday,
      recentActivity: mergedActivity,
      houses: houseList.map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        points: h.points ?? 0,
        members: h.users?.length ?? 0,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
