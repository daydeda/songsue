import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, houses, users } from "@/db/schema";
import { count } from "drizzle-orm";
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

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="activecamt_attendance_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // Default: Overview stats
    const [{ count: totalUsers }] = await db.select({ count: count() }).from(users);
    const [{ count: totalEvents }] = await db.select({ count: count() }).from(events);

    const houseList = await db.query.houses.findMany({
      columns: { id: true, name: true, points: true, color: true },
      with: { users: { columns: { id: true } } },
    });

    return NextResponse.json({
      totalUsers,
      totalEvents,
      houses: houseList.map((h) => ({
        name: h.name,
        color: h.color,
        points: h.points ?? 0,
        members: h.users.length,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
