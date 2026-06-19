import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, eventSessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
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
    // Optional ?sessionId= narrows the export to one day of a multi-day event,
    // mirroring the on-screen roster's day picker.
    const sessionIdFilter = new URL(req.url).searchParams.get("sessionId");

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { id: true, title: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Resolve the day's label for the audit log + filename when a day is selected.
    let sessionLabelForFile: string | null = null;
    if (sessionIdFilter) {
      const s = await db.query.eventSessions.findFirst({
        where: and(eq(eventSessions.id, sessionIdFilter), eq(eventSessions.eventId, eventId)),
        columns: { title: true, sortOrder: true },
      });
      if (!s) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      sessionLabelForFile = s.title?.trim() || `Day ${s.sortOrder + 1}`;
    }

    const list = await db.query.attendance.findMany({
      where: sessionIdFilter
        ? and(eq(attendance.eventId, eventId), eq(attendance.sessionId, sessionIdFilter))
        : eq(attendance.eventId, eventId),
      with: {
        session: { columns: { title: true, sortOrder: true } },
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
      action: `Exported attendee XLSX for event ${eventId}${sessionLabelForFile ? ` [${sessionLabelForFile}]` : ""} (${list.length} rows${canViewMedical ? ", included health info" : ""})`,
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

    // One row object per attendance record. The day no longer needs a "Session"
    // column — each day gets its own worksheet (see grouping below).
    const buildRow = (m: (typeof list)[number]): Record<string, string> => {
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
    };

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

    // Group RAW attendance per day so the roster sheets and the Summary sheet are
    // derived from the same source. With ?sessionId= the list is already a single
    // day; otherwise we enumerate every session so even days with no check-ins
    // still get their own (header-only) sheet.
    type Att = (typeof list)[number];
    type DayGroup = { label: string; rows: Att[] };
    let groups: DayGroup[];
    // "Multi-day" is keyed off the count of REAL sessions, not the group count —
    // so an event with no sessions (or one session plus some legacy null-session
    // rows) is still treated as single-day (one roster sheet, everyone included).
    let isMultiDay = false;
    if (sessionIdFilter) {
      groups = [{ label: sessionLabelForFile || "Attendees", rows: list }];
    } else {
      const sessions = await db.query.eventSessions.findMany({
        where: eq(eventSessions.eventId, eventId),
        columns: { id: true, title: true, sortOrder: true },
        orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.startTime)],
      });
      isMultiDay = sessions.length > 1;
      const rowsBySession = new Map<string, Att[]>();
      const orphans: Att[] = [];
      for (const m of list) {
        const sid = m.sessionId;
        if (sid && sessions.some((s) => s.id === sid)) {
          const arr = rowsBySession.get(sid) ?? [];
          arr.push(m);
          rowsBySession.set(sid, arr);
        } else {
          orphans.push(m);
        }
      }
      groups = sessions.map((s) => ({
        label: s.title?.trim() || `Day ${s.sortOrder + 1}`,
        rows: rowsBySession.get(s.id) ?? [],
      }));
      if (orphans.length > 0) groups.push({ label: "Unassigned", rows: orphans });
    }

    // Per-scope tallies, reused for each day and the event-wide total.
    const statsFor = (rows: Att[]) => {
      const pre = rows.filter((a) => a.method === "pre-registered");
      const preTotal = pre.length;
      const preAttended = pre.filter((a) => a.status === "attended").length;
      const walkIns = rows.filter((a) => a.method === "walk-in").length;
      const noShow = Math.max(0, preTotal - preAttended);
      const checkedIn = rows.filter((a) => a.status === "attended").length;
      const distinct = new Set(rows.map((a) => a.studentId)).size;
      const pct = preTotal > 0 ? (noShow / preTotal) * 100 : 0;
      return { preTotal, preAttended, walkIns, noShow, checkedIn, distinct, pct };
    };

    const XLSX = await import("xlsx");
    const makeSheet = (rows: Record<string, string>[]) => {
      const ws = XLSX.utils.json_to_sheet(rows, { header });
      ws["!autofilter"] = { ref: ws["!ref"] || "A1" };
      ws["!cols"] = header.map((h) => ({ wch: Math.min(40, Math.max(12, h.length + 2)) }));
      return ws;
    };
    // Excel sheet names: ≤31 chars, none of : \ / ? * [ ], unique, non-empty.
    const usedNames = new Set<string>();
    const toSheetName = (label: string) => {
      const base = (label.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31)) || "Day";
      let name = base;
      let i = 2;
      while (usedNames.has(name.toLowerCase())) {
        const suffix = ` (${i++})`;
        name = base.slice(0, 31 - suffix.length) + suffix;
      }
      usedNames.add(name.toLowerCase());
      return name;
    };

    const wb = XLSX.utils.book_new();

    // Summary sheet FIRST: per-day breakdown for multi-day events, plus an
    // event-wide total row (the only row when single-day / single-day filtered).
    const summaryHeader = [
      "Day", "Pre-registered", "Attended", "No-shows", "No-show %",
      "Walk-ins", "Total Checked-in", "Distinct Students",
    ];
    const summaryRowFor = (label: string, rows: Att[]): Record<string, string | number> => {
      const s = statsFor(rows);
      return {
        "Day": label,
        "Pre-registered": s.preTotal,
        "Attended": s.preAttended,
        "No-shows": s.noShow,
        "No-show %": `${s.pct.toFixed(1)}%`,
        "Walk-ins": s.walkIns,
        "Total Checked-in": s.checkedIn,
        "Distinct Students": s.distinct,
      };
    };
    const summaryRows: Record<string, string | number>[] = [];
    if (isMultiDay) {
      for (const g of groups) summaryRows.push(summaryRowFor(g.label, g.rows));
    }
    summaryRows.push(summaryRowFor(isMultiDay ? "ALL DAYS (total)" : "Total", list));
    const summaryWs = XLSX.utils.json_to_sheet(summaryRows, { header: summaryHeader });
    summaryWs["!autofilter"] = { ref: summaryWs["!ref"] || "A1" };
    summaryWs["!cols"] = summaryHeader.map((h) => ({ wch: Math.max(14, h.length + 2) }));
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    // Then the roster sheet(s).
    if (!isMultiDay) {
      // Single-day event, no sessions, or a one-day filtered export: one "Attendees"
      // sheet holding everyone (use `list`, not groups[0], so no orphan row is lost).
      const singleRows = sessionIdFilter ? (groups[0]?.rows ?? []) : list;
      XLSX.utils.book_append_sheet(wb, makeSheet(singleRows.map(buildRow)), "Attendees");
    } else {
      for (const g of groups) {
        XLSX.utils.book_append_sheet(wb, makeSheet(g.rows.map(buildRow)), toSheetName(g.label));
      }
    }
    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Keep Thai/Unicode in the filename via RFC 5987 filename*, with an
    // ASCII-only fallback for older clients.
    const sanitize = (s: string) =>
      s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").replace(/^_+|_+$/g, "");
    const safeTitle = sanitize(event.title || "event").slice(0, 40) || "event";
    const daySuffix = sessionLabelForFile ? `_${sanitize(sessionLabelForFile).slice(0, 20)}` : "";
    const fileName = `attendees_${safeTitle}${daySuffix}.xlsx`;
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
