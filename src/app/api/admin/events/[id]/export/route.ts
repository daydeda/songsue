import { auth } from "@/auth";
import { db } from "@/db";
import { attendance, events, eventSessions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { AuditService, getClientIp } from "@/modules/audit/audit.service";
import { EventScopeService } from "@/modules/events/event-scope.service";
import { redactEmergencyContacts } from "@/lib/emergency-contacts";
import { resolveFacultyViewScope, matchesFacultyScope } from "@/lib/faculty-scope";

// xlsx is a CommonJS package — keep this route on the Node.js runtime.
export const runtime = "nodejs";

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

// The medical/emergency columns are selected conditionally (super_admin only),
// and email/phone/contactChannels are selected conditionally (thin-roster roles
// get none of them), so Drizzle infers them as absent. Treat them as optional
// when present.
type AttendeeUser = {
  name: string;
  nickname: string | null;
  studentId: string | null;
  email?: string;
  phone?: string | null;
  contactChannels?: string | null;
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
// auto-filter enabled. Staff (super_admin/admin) may export any event.
// Scanner-only student-leader roles (smo/club_president/major_president) may
// also export: smo only gets a THIN roster (no phone, no meds-check, no
// medical or emergency-contact columns — mirrors THIN_USER_COLUMNS in the
// sibling attendance API) — same "ask an admin for detail" policy enforced
// there. club_president/major_president instead get the FULL roster
// (including medical detail) for events they OWN, scoped below — by
// deliberate product decision (2026-07-18) mirroring the club/major
// member-roster grant (see ClubsService.getClubMembers) — except emergency
// contacts are redacted to relationship + phone only (no contact name), same
// as that roster; the audit log is the accountability mechanism.
// registration/organizer still cannot export at all (unlike the
// attendance/report endpoints, which admit them for on-screen viewing).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const roles =
      session?.user?.roles ??
      (session?.user?.role ? [session.user.role] : []);
    const isStaffRole = roles.includes("super_admin") || roles.includes("admin");
    const isPresidentRole = roles.some((r) => ["club_president", "major_president"].includes(r));
    const isThinExportRole = roles.some((r) =>
      ["smo", "club_president", "major_president"].includes(r)
    );
    const canExport = isStaffRole || isThinExportRole;
    if (!session?.user || !canExport) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Faculty scoping (see src/lib/faculty-scope.ts): applied on top of the
    // club/major-owner scoping below.
    const facultyScope = resolveFacultyViewScope(roles, session.user.faculty);
    if (!facultyScope.global && facultyScope.faculty === null) {
      return NextResponse.json(
        { error: "No faculty assigned to your account yet. Ask a super admin to assign one." },
        { status: 403 },
      );
    }

    const canViewMedical = roles.includes("super_admin");
    // A club/major president exporting an event THEY OWN (scoped below) also
    // gets medical detail + (redacted) emergency contacts — see isPresidentRole
    // comment above.
    const includeMedicalColumns = canViewMedical || isPresidentRole;
    // Thin export: identity + check-in only, same as the attendance roster's
    // thin-roster view. Any staff role, or a president exporting their own
    // event, overrides this.
    const isThinRoster = !isStaffRole && !isPresidentRole;

    const { id: eventId } = await params;
    // Optional ?sessionId= narrows the export to one day of a multi-day event,
    // mirroring the on-screen roster's day picker.
    const sessionIdFilter = new URL(req.url).searchParams.get("sessionId");

    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      columns: { id: true, title: true, managedByRoles: true, ownerClubIds: true, ownerMajors: true },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Event scoping for president roles (mirrors the attendance API): club_president
    // / major_president may only export events they OWN (ownerClubIds/ownerMajors
    // match their own club membership / major). Staff and smo are unscoped. This
    // is what makes the medical-detail grant above safe: a president only ever
    // reaches past this check for an event their own club/major owns.
    if (!isStaffRole && isPresidentRole) {
      const scope = await EventScopeService.getPresidentScope(session.user.id!, roles);
      const managed = EventScopeService.isEventManagedByScope(event, scope);
      if (!managed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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

    const rawList = await db.query.attendance.findMany({
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
            // Fetched unconditionally (not PDPA-sensitive) to apply the
            // faculty-scope filter below — see src/lib/faculty-scope.ts.
            faculty: true,
            email: !isThinRoster,
            phone: !isThinRoster,
            contactChannels: !isThinRoster,
            major: true,
            role: true,
            chronicDiseases: includeMedicalColumns,
            medicalHistory: includeMedicalColumns,
            drugAllergies: includeMedicalColumns,
            foodAllergies: includeMedicalColumns,
            dietaryRestrictions: includeMedicalColumns,
            faintingHistory: includeMedicalColumns,
            emergencyMedication: includeMedicalColumns,
            emergencyContacts: includeMedicalColumns,
          },
          with: {
            house: { columns: { name: true } },
          },
        },
      },
      orderBy: (attendance, { desc }) => [desc(attendance.checkInTime)],
    });

    // Faculty scoping: drop rows outside the viewer's faculty. A relational
    // `with: { user }` query can't push this into the WHERE clause, so it's
    // filtered in-memory here; every downstream reference below uses `list`.
    const list = facultyScope.global
      ? rawList
      : rawList.filter((row) => matchesFacultyScope(row.user?.faculty, facultyScope, row.user?.role));

    // Defensive cap: the whole roster + the xlsx buffer are built in memory (xlsx
    // can't stream). Per-event this is bounded, but refuse a pathologically large
    // export rather than risk OOM — the admin can export one day at a time instead.
    const MAX_EXPORT_ROWS = 50000;
    if (list.length > MAX_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `This export is too large (${list.length} rows). Please use the day filter to export one session at a time.` },
        { status: 413 }
      );
    }

    // Bulk PII export — keep a tamper-evident record of who pulled it (PDPA), and
    // note the health info in the export. Mirrors the CSV report and the
    // attendance-list access log.
    //
    // The "Meds Check" (medsCheckOption) column is in every non-thin export, so a
    // plain admin's export still carries health info the descriptor must disclose.
    // super_admin additionally receives full medical detail + full emergency-contact
    // columns (incl. contact name); a club/major president exporting their own
    // event gets the same medical detail but with the contact's NAME redacted
    // (relationship + phone only); a plain admin gets only the meds-check signal.
    // Thin-roster exporters (smo) get neither — no health info of any kind. Record
    // which, so the log never understates (or overstates) the exposure.
    const healthNote = canViewMedical
      ? ", included health detail + emergency contacts"
      : isPresidentRole
      ? ", included health detail + emergency contacts (relationship/phone only, president tier)"
      : isThinRoster
      ? ", no health info (thin roster)"
      : ", included meds-check status";
    await AuditService.logAction({
      actorId: session.user.id!,
      action: `Exported attendee XLSX for event "${event.title}" (${eventId})${sessionLabelForFile ? ` [${sessionLabelForFile}]` : ""} (${list.length} rows${healthNote})`,
      ipAddress: getClientIp(req),
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
    // President tier: same emergency-contact data, but the contact's own name
    // is redacted before it ever reaches a column (relationship + phone only).
    const fmtContactsRedacted = (contacts: unknown) =>
      redactEmergencyContacts(contacts).map((c) => `${c.relationship}: ${c.phone}`).join("; ");
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
        "Major": u?.major || "",
        "Role": u?.role || "",
        "House": u?.house?.name || "",
        "Staff": m.isStaff ? "Yes" : "",
        "Status": m.status === "attended" ? "Checked In" : m.status || "",
        "Check-in (Bangkok)": fmtTime(m.checkInTime),
        "Method": m.method || "",
      };
      // Thin-roster exporters (smo) get identity + check-in only — no email,
      // phone, contact channels, or meds-check status (the latter would reveal
      // a medical condition). Mirrors THIN_USER_COLUMNS in the sibling
      // attendance API. They must ask an admin for detail. club_president/
      // major_president are NOT thin (see isThinRoster above), so this branch
      // covers them too.
      if (!isThinRoster) {
        base["Email"] = u?.email || "";
        base["Phone"] = u?.phone || "";
        base["Contact Channels"] = u?.contactChannels || "";
        base["Meds Check"] = m.medsCheckOption || "";
      }
      if (includeMedicalColumns) {
        base["Chronic Diseases"] = u?.chronicDiseases || "";
        base["Medical History"] = u?.medicalHistory || "";
        base["Drug Allergies"] = u?.drugAllergies || "";
        base["Food Allergies"] = u?.foodAllergies || "";
        base["Dietary Restrictions"] = u?.dietaryRestrictions || "";
        base["Fainting History"] = u?.faintingHistory ? "Yes" : "";
        base["Emergency Medication"] = u?.emergencyMedication || "";
        base["Emergency Contacts"] = canViewMedical
          ? fmtContacts(u?.emergencyContacts)
          : fmtContactsRedacted(u?.emergencyContacts);
      }
      return base;
    };

    const header = [
      "Name", "Nickname", "Student ID", "Nationality",
      ...(!isThinRoster ? ["Email", "Phone", "Contact Channels"] : []),
      "Major", "Role", "House", "Staff", "Status", "Check-in (Bangkok)", "Method",
      ...(!isThinRoster ? ["Meds Check"] : []),
      ...(includeMedicalColumns
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

    // Per-DAY tallies: one attendance row per person per day, so counting raw
    // rows is correct here (a single day has ≤1 row per person).
    const statsFor = (rows: Att[]) => {
      const pre = rows.filter((a) => a.method === "pre-registered");
      const preTotal = pre.length;
      const preAttended = pre.filter((a) => a.status === "attended").length;
      const walkIns = rows.filter((a) => a.method === "walk-in").length;
      const noShow = Math.max(0, preTotal - preAttended);
      const checkedIn = rows.filter((a) => a.status === "attended").length;
      const distinct = new Set(rows.map((a) => a.studentId)).size;
      const staff = new Set(rows.filter((a) => a.isStaff).map((a) => a.studentId)).size;
      // "Attendees" for project-evidence purposes: real participants only, staff
      // who ran the event excluded. distinct always includes staff as a subset.
      const attendeesOnly = distinct - staff;
      const pct = preTotal > 0 ? (noShow / preTotal) * 100 : 0;
      return { preTotal, preAttended, walkIns, noShow, checkedIn, distinct, staff, attendeesOnly, pct };
    };

    // Event-wide ("ALL DAYS") tallies must COUNT EACH STUDENT ONCE, not sum the
    // per-day rows: a person present on Day 1 and Day 2 has one row per day, so
    // summing double-counts them. Collapse to one unit per student — keyed exactly
    // like the on-screen "All days" tallies (studentId, then user.studentId, then
    // the row id) — and classify each person across all their day rows: pre-
    // registered if ANY day was a pre-registration, attended if present on ANY day,
    // walk-in only if EVERY day was a walk-in. Mirrors the UI summary in
    // src/app/admin/events/page.tsx so the export total matches the screen.
    const distinctStatsFor = (rows: Att[]) => {
      const byStudent = new Map<string, Att[]>();
      for (const a of rows) {
        const k = a.studentId || a.user?.studentId || a.id;
        const arr = byStudent.get(k);
        if (arr) arr.push(a);
        else byStudent.set(k, [a]);
      }
      const units = [...byStudent.values()];
      const preTotal = units.filter((u) => u.some((a) => a.method === "pre-registered")).length;
      const preAttended = units.filter(
        (u) => u.some((a) => a.method === "pre-registered") && u.some((a) => a.status === "attended")
      ).length;
      const walkIns = units.filter((u) => u.every((a) => a.method === "walk-in")).length;
      const noShow = Math.max(0, preTotal - preAttended);
      const checkedIn = units.filter((u) => u.some((a) => a.status === "attended")).length;
      const distinct = units.length;
      const staff = units.filter((u) => u.some((a) => a.isStaff)).length;
      const attendeesOnly = distinct - staff;
      const pct = preTotal > 0 ? (noShow / preTotal) * 100 : 0;
      return { preTotal, preAttended, walkIns, noShow, checkedIn, distinct, staff, attendeesOnly, pct };
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
      "Walk-ins", "Total Checked-in", "Staff", "Attendees (excl. Staff)",
    ];
    const summaryRowFor = (
      label: string,
      rows: Att[],
      stats: (rows: Att[]) => ReturnType<typeof statsFor> = statsFor
    ): Record<string, string | number> => {
      const s = stats(rows);
      return {
        "Day": label,
        "Pre-registered": s.preTotal,
        "Attended": s.preAttended,
        "No-shows": s.noShow,
        "No-show %": `${s.pct.toFixed(1)}%`,
        "Walk-ins": s.walkIns,
        "Total Checked-in": s.checkedIn,
        "Staff": s.staff,
        "Attendees (excl. Staff)": s.attendeesOnly,
      };
    };
    const summaryRows: Record<string, string | number>[] = [];
    if (isMultiDay) {
      for (const g of groups) summaryRows.push(summaryRowFor(g.label, g.rows));
    }
    // Multi-day total dedupes per student (distinctStatsFor); single-day already
    // has ≤1 row per person, so the raw statsFor total is already distinct.
    summaryRows.push(
      isMultiDay
        ? summaryRowFor("ALL DAYS (distinct students)", list, distinctStatsFor)
        : summaryRowFor("Total", list)
    );
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
