import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/audit.service";

// xlsx is a CommonJS package — keep this route on the Node.js runtime.
export const runtime = "nodejs";

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

// The medical/emergency columns are selected conditionally (super_admin only),
// so Drizzle infers them as absent. Treat them as optional when present.
type AttendeeUser = {
  name: string;
  nickname: string | null;
  studentId: string | null;
  email: string;
  phone: string | null;
  major: string | null;
  role: string | null;
  house: { name: string } | null;
  chronicDiseases?: string | null;
  medicalHistory?: string | null;
  drugAllergies?: string | null;
  foodAllergies?: string | null;
  dietaryRestrictions?: string | null;
  faintingHistory?: boolean | null;
  emergencyMedication?: string | null;
  emergencyContacts?: unknown;
};

// GET /api/admin/events/[id]/export — attendee list as a real .xlsx with
// auto-filter enabled. Restricted to super_admin/admin only (unlike the
// attendance/report endpoints, which also admit registration/organizer).
// Medical & emergency-contact columns follow the same policy as the attendance
// API: included for super_admin only.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const roles =
      session?.user?.roles ??
      (session?.user?.role ? [session.user.role] : []);
    const canExport = roles.includes("super_admin") || roles.includes("admin");
    if (!session?.user || !canExport) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const canViewMedical = roles.includes("super_admin");

    const { id: eventId } = await params;

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { id: true, title: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const list = await db.query.attendance.findMany({
      where: eq(attendance.eventId, eventId),
      with: {
        user: {
          columns: {
            name: true,
            nickname: true,
            studentId: true,
            email: true,
            phone: true,
            major: true,
            role: true,
            chronicDiseases: canViewMedical,
            medicalHistory: canViewMedical,
            drugAllergies: canViewMedical,
            foodAllergies: canViewMedical,
            dietaryRestrictions: canViewMedical,
            faintingHistory: canViewMedical,
            emergencyMedication: canViewMedical,
            emergencyContacts: canViewMedical,
          },
          with: {
            house: { columns: { name: true } },
          },
        },
      },
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
    });

    // Bulk PII export — keep a tamper-evident record of who pulled it (PDPA),
    // and note when health info was part of the export. Mirrors the CSV report
    // and the attendance-list access log.
    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Exported attendee XLSX for event ${eventId} (${list.length} rows${canViewMedical ? ", included health info" : ""})`,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1",
    });

    // Same nationality heuristic as the admin events UI: the first of the last
    // three digits of the student ID being "5" marks an international student.
    const nationality = (studentId: string | null | undefined) => {
      const cleanId = (studentId || "").trim();
      return cleanId.length >= 3 && cleanId.slice(-3)[0] === "5"
        ? "International"
        : "Thai";
    };
    const fmtContacts = (contacts: unknown) =>
      Array.isArray(contacts)
        ? (contacts as EmergencyContact[])
            .map((c) => `${c.name} (${c.relationship}) ${c.phone}`)
            .join("; ")
        : "";
    const fmtTime = (d: Date | null) =>
      d ? d.toLocaleString("en-GB", { timeZone: "Asia/Bangkok" }) : "";

    const rows = list.map((m) => {
      const u = m.user as AttendeeUser | null;
      const base: Record<string, string> = {
        "Name": u?.name || "",
        "Nickname": u?.nickname || "",
        "Student ID": u?.studentId || "",
        "Nationality": nationality(u?.studentId),
        "Email": u?.email || "",
        "Phone": u?.phone || "",
        "Major": u?.major || "",
        "Role": u?.role || "",
        "House": u?.house?.name || "",
        "Status": m.status === "attended" ? "Checked In" : m.status || "",
        "Check-in (Bangkok)": fmtTime(m.checkInTime),
        "Method": m.method || "",
        "Meds Check": m.medsCheckOption || "",
      };
      if (canViewMedical) {
        base["Chronic Diseases"] = u?.chronicDiseases || "";
        base["Medical History"] = u?.medicalHistory || "";
        base["Drug Allergies"] = u?.drugAllergies || "";
        base["Food Allergies"] = u?.foodAllergies || "";
        base["Dietary Restrictions"] = u?.dietaryRestrictions || "";
        base["Fainting History"] = u?.faintingHistory ? "Yes" : "";
        base["Emergency Medication"] = u?.emergencyMedication || "";
        base["Emergency Contacts"] = fmtContacts(u?.emergencyContacts);
      }
      return base;
    });

    const XLSX = await import("xlsx");
    const header = [
      "Name", "Nickname", "Student ID", "Nationality", "Email", "Phone",
      "Major", "Role", "House", "Status", "Check-in (Bangkok)", "Method", "Meds Check",
      ...(canViewMedical
        ? [
            "Chronic Diseases", "Medical History", "Drug Allergies", "Food Allergies",
            "Dietary Restrictions", "Fainting History", "Emergency Medication", "Emergency Contacts",
          ]
        : []),
    ];
    const ws = XLSX.utils.json_to_sheet(rows, { header });
    ws["!autofilter"] = { ref: ws["!ref"] || "A1" };
    ws["!cols"] = header.map((h) => ({ wch: Math.min(40, Math.max(12, h.length + 2)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendees");
    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Keep Thai/Unicode in the filename via RFC 5987 filename*, with an
    // ASCII-only fallback for older clients.
    const safeTitle =
      (event.title || "event")
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 40)
        .replace(/^_+|_+$/g, "") || "event";
    const fileName = `attendees_${safeTitle}.xlsx`;
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_");

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export attendee XLSX:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
