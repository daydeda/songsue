"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { NON_SMO_POSITION_IDS, POSITION_I18N_KEY } from "@/lib/positions";
import { Download, Users, HeartPulse, ChevronDown, ChevronUp } from "lucide-react";

type MajorTeamMember = {
  id: string;
  name: string | null;
  nickname: string | null;
  studentId: string | null;
  phone: string | null;
  contactChannels: string | null;
  house: { id: string; name: string; color: string | null } | null;
  position: string | null;
  // This row IS the major's president (roles includes major_president) — see
  // MajorsService.getMajorMembers. Locks the position control to "President".
  isPresident: boolean;
};

// Medical/emergency-contact detail for ONE student — fetched on demand from
// GET .../members/[memberId]/medical (never bundled into the roster fetch
// above) only when that student's panel is expanded, and audit-logged as
// that specific student being viewed (see MajorsService.getMajorMemberMedical).
// Emergency contacts are pre-redacted server-side to relationship + phone
// only (no contact name).
type MajorTeamMemberMedical = {
  chronicDiseases: string | null;
  medicalHistory: string | null;
  drugAllergies: string | null;
  foodAllergies: string | null;
  dietaryRestrictions: string | null;
  faintingHistory: boolean | null;
  emergencyMedication: string | null;
  emergencyContacts: { relationship: string; phone: string }[];
};

// major_president-only "Team" panel — the major analogue of admin/clubs's
// Members modal, except majors have no roster to add/remove (membership is
// just users.major, see MajorsService), so this only ever ANNOTATES existing
// members with a position, never adds/removes them. GET is already scoped
// server-side to the signed-in president's own major (see
// api/admin/majors/[code]/members/route.ts); PATCH re-verifies the same scope.
export function MajorTeamSection({ major }: { major: string }) {
  const { t } = useLanguage();
  const [members, setMembers] = useState<MajorTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which member's Medical & Emergency panel is expanded — one at a time,
  // collapsed by default. Unlike the rest of the row, this data is NOT in
  // `members` — it's fetched (and audit-logged) per student, on first
  // expand, via GET .../members/[memberId]/medical, then cached here so
  // re-toggling the same student doesn't re-fetch/re-log. Keyed by user id
  // (== m.id for majors — see MajorsService.getMajorMembers).
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [medicalById, setMedicalById] = useState<Record<string, MajorTeamMemberMedical>>({});
  const [loadingMedicalId, setLoadingMedicalId] = useState<string | null>(null);
  const [medicalError, setMedicalError] = useState<string | null>(null);

  const loadMembers = () => {
    setError(null);
    setLoading(true);
    fetch(`/api/admin/majors/${major}/members`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error((data && data.error) || "Failed to load team");
        }
        return r.json();
      })
      .then((data) => setMembers(data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load team"))
      .finally(() => setLoading(false));
  };

  // Toggles a student's Medical & Emergency panel. On first expand (not yet
  // cached), fetches + audit-logs that ONE student's medical detail.
  // Re-collapsing/re-expanding afterward just reuses the cached result.
  const toggleMemberExpand = (m: MajorTeamMember) => {
    const next = expandedMemberId === m.id ? null : m.id;
    setExpandedMemberId(next);
    if (!next || m.id in medicalById) return;
    setMedicalError(null);
    setLoadingMedicalId(m.id);
    fetch(`/api/admin/majors/${major}/members/${m.id}/medical`)
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => null);
          throw new Error((data && data.error) || "Failed to load medical detail");
        }
        return r.json();
      })
      .then((data) => setMedicalById((prev) => ({ ...prev, [m.id]: data })))
      .catch((err) => setMedicalError(err instanceof Error ? err.message : "Failed to load medical detail"))
      .finally(() => setLoadingMedicalId((id) => (id === m.id ? null : id)));
  };

  useEffect(() => {
    // Deferred via setTimeout so the setState calls in loadMembers fire after
    // this render commits, not synchronously within the effect — mirrors the
    // pattern in admin/majors/page.tsx (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setExpandedMemberId(null);
      setMedicalById({});
      setLoadingMedicalId(null);
      setMedicalError(null);
      loadMembers();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [major]);

  // Export the major's roster as .xlsx. Built server-side at
  // /api/admin/majors/[code]/members/export, which re-checks the same scope
  // gate and audit-logs the pull (PDPA bulk PII export) — mirrors
  // exportAttendanceXlsx on admin/events/page.tsx.
  const exportMembersXlsx = () => {
    const a = document.createElement("a");
    a.href = `/api/admin/majors/${major}/members/export`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const updatePosition = async (userId: string, position: string | null) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/majors/${major}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, position }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error((data && data.error) || "Failed to update position");
      }
      loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update position");
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 24,
        padding: 24,
        marginBottom: 32,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={20} style={{ color: "var(--text-muted)" }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
            {t.myTeam || "My Team"}
          </h2>
        </div>
        {members.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={exportMembersXlsx}
            title="Export the full roster (identity, contact, house, position, medical & emergency contact) to Excel (.xlsx) — this export is audit-logged"
          >
            <Download size={14} />
            Export
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        </div>
      ) : error ? (
        <p style={{ color: "#ef4444", fontWeight: 600, fontSize: 13 }}>{error}</p>
      ) : members.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: 13 }}>
          {t.noTeamMembers || "No students in your major yet."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {members.map((m) => {
            const isExpanded = expandedMemberId === m.id;
            const medical = medicalById[m.id];
            const isLoadingMedical = loadingMedicalId === m.id;
            const hasMedicalDetail = !!(
              medical && (medical.chronicDiseases || medical.medicalHistory || medical.drugAllergies || medical.foodAllergies ||
              medical.dietaryRestrictions || medical.faintingHistory || medical.emergencyMedication || medical.emergencyContacts.length > 0)
            );
            return (
            <div key={m.id} style={{ borderRadius: 12, background: "var(--bg-elevated)", overflow: "hidden" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
                onClick={() => toggleMemberExpand(m)}
              >
                <div style={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 6 }}>
                  {isExpanded ? <ChevronUp size={14} style={{ marginTop: 3, flexShrink: 0, color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ marginTop: 3, flexShrink: 0, color: "var(--text-muted)" }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                      {m.name || "Unnamed"}{m.nickname ? ` (${m.nickname})` : ""}
                    </div>
                    {m.studentId && (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
                        {m.studentId}
                      </div>
                    )}
                    {/* Full roster detail — the members GET route already scopes this
                        to super_admin/admin or the major's own president, so every
                        row reaching this client is already authorized to see it (see
                        MajorsService.getMajorMembers). */}
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {m.house?.name && <span>{m.house.name}</span>}
                      {m.phone && <span>{m.phone}</span>}
                      {m.contactChannels && <span>{m.contactChannels}</span>}
                    </div>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {m.isPresident ? (
                    // Locked: the major_president's position is always "President"
                    // (MajorsService.setMemberPosition keeps users.position in sync
                    // server-side) — no editable control is ever rendered here, for
                    // anyone, including super_admin.
                    <span className="badge badge-blue" style={{ flexShrink: 0 }}>President</span>
                  ) : (
                    <select
                      className="input"
                      style={{ width: 160, fontSize: 12, padding: "4px 8px", flexShrink: 0 }}
                      value={m.position || ""}
                      onChange={(e) => updatePosition(m.id, e.target.value || null)}
                    >
                      <option value="">—</option>
                      {NON_SMO_POSITION_IDS.map((id) => (
                        <option key={id} value={id}>{t[POSITION_I18N_KEY[id] as keyof typeof t]}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {/* Medical & Emergency — collapsed by default, one member at a time.
                  Unlike the rest of the row, this data is fetched (and audit-logged
                  as THIS student being viewed) on first expand, not bundled into the
                  roster load — see toggleMemberExpand. Emergency contacts are
                  pre-redacted server-side to relationship + phone only (no contact
                  name). */}
              {isExpanded && (
                <div style={{ padding: "0 12px 12px 32px", borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
                  {isLoadingMedical ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 10 }}>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    </div>
                  ) : !medical ? (
                    <p style={{ fontSize: 12, color: "#ef4444" }}>{medicalError || "Failed to load medical detail."}</p>
                  ) : !hasMedicalDetail ? (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No medical info on file.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                        <HeartPulse size={13} /> Medical & Emergency
                      </div>
                      {medical.chronicDiseases && <p style={{ fontSize: 12 }}><b>Chronic:</b> {medical.chronicDiseases}</p>}
                      {medical.medicalHistory && <p style={{ fontSize: 12 }}><b>History:</b> {medical.medicalHistory}</p>}
                      {medical.drugAllergies && <p style={{ fontSize: 12, color: "#ef4444" }}><b>Drug allergies:</b> {medical.drugAllergies}</p>}
                      {medical.foodAllergies && <p style={{ fontSize: 12, color: "#ef4444" }}><b>Food allergies:</b> {medical.foodAllergies}</p>}
                      {medical.dietaryRestrictions && <p style={{ fontSize: 12 }}><b>Dietary:</b> {medical.dietaryRestrictions}</p>}
                      {medical.faintingHistory && <p style={{ fontSize: 12, color: "#ef4444" }}>History of fainting</p>}
                      {medical.emergencyMedication && <p style={{ fontSize: 12, color: "#ef4444" }}><b>Emergency medication:</b> {medical.emergencyMedication}</p>}
                      {medical.emergencyContacts.length > 0 && (
                        <p style={{ fontSize: 12 }}>
                          <b>Emergency contact:</b>{" "}
                          {medical.emergencyContacts.map((c, i) => (
                            <span key={i}>{i > 0 ? "; " : ""}{c.relationship}: {c.phone}</span>
                          ))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
