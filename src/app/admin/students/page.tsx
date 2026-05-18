"use client";

import { useEffect, useState } from "react";
import {
  Search, Users, ShieldAlert, Heart, Phone,
  ChevronRight, Filter, MoreVertical, X,
  AlertCircle, ShieldCheck, User as UserIcon,
  Activity, GraduationCap, MapPin, ChevronDown,
  Edit2, Trash2, Save
} from "lucide-react";

type Student = {
  id: string;
  studentId?: string;
  name: string;
  nickname?: string;
  major?: string;
  phone?: string;
  houseId?: string;
  house?: { name: string; color?: string } | null;
  profileCompleted?: boolean;
};

export default function AdminStudentsDirectory() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [sensitiveData, setSensitiveData] = useState<any>(null);
  const [loadingSensitive, setLoadingSensitive] = useState(false);

  const [houses, setHouses] = useState<{ id: string; name: string }[]>([]);
  const [houseFilter, setHouseFilter] = useState<string>("all");
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);

  const hasActualMedicalInfo = (user: any) => {
    if (!user) return false;
    const fields = [
      user.chronicDiseases,
      user.medicalHistory,
      user.drugAllergies,
      user.foodAllergies,
      user.dietaryRestrictions
    ];
    const isMeaningful = (val: any) => {
      if (typeof val !== 'string') return !!val;
      const t = val.trim();
      return t !== "" && t !== "-";
    };
    return fields.some(isMeaningful) || user.faintingHistory === true;
  };

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setLoading(true);
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setStudents(d); })
      .finally(() => setLoading(false));

    fetch("/api/admin/houses")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setHouses(d); });
  };

  const filtered = students.filter(
    (s) => {
      const matchesSearch = s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.studentId?.includes(search) ||
        s.nickname?.toLowerCase().includes(search.toLowerCase());

      const matchesHouse = houseFilter === "all" || s.houseId === houseFilter;

      return matchesSearch && matchesHouse;
    }
  );

  const viewSensitive = async (id: string) => {
    if (!confirm("⚠ CRITICAL ACCESS: Viewing medical/emergency data will be permanently logged. Continue?")) return;
    setViewingId(id);
    setLoadingSensitive(true);
    setSensitiveData(null);
    try {
      const res = await fetch(`/api/admin/students/${id}`);
      if (res.ok) setSensitiveData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSensitive(false);
    }
  };

  return (
    <>
      <div className="animate-fade-in-up pb-24">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6" style={{ marginBottom: 40 }}>
          <h1 className="text-[clamp(32px,5vw,48px)] font-black tracking-tighter text-[var(--text-primary)] leading-tight">Student Directory</h1>
          <div className="flex items-center gap-5 bg-[var(--bg-surface)] px-7 py-4 rounded-[40px] border border-[var(--border-subtle)] shadow-xl shadow-black/5 flex-shrink-0">
            <div className="flex-shrink-0 w-14 h-14 rounded-[20px] bg-[var(--accent-glow)] flex items-center justify-center text-[var(--accent-primary)]">
              <Users size={26} />
            </div>
            <div className="flex flex-col min-w-[120px]">
              <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{filtered.length}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 5, whiteSpace: "nowrap" }}>Active Members</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col md:flex-row gap-5 bg-[var(--bg-surface)] p-4 rounded-[32px] border border-[var(--border-subtle)] shadow-2xl shadow-black/5" style={{ marginBottom: 48 }}>
          <div className="relative flex-1 group">
            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-[var(--accent-primary)]" />
            <input
              id="student-search-input"
              className="input w-full h-14 bg-[var(--bg-elevated)] border-none rounded-2xl text-base font-medium transition-all focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              style={{ paddingLeft: 60 }}
              type="text"
              placeholder="Search by name, nickname, or student ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative min-w-[240px] group">
            <Filter size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-[var(--accent-primary)] z-10" />
            <select
              className="input w-full h-14 bg-[var(--bg-elevated)] border-none rounded-2xl text-base font-bold appearance-none cursor-pointer transition-all focus:ring-2 focus:ring-[var(--accent-primary)]/20"
              style={{ paddingLeft: 56, paddingRight: 48 }}
              value={houseFilter}
              onChange={(e) => setHouseFilter(e.target.value)}
            >
              <option value="all">All Houses</option>
              {houses.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Data Table Container */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 40,
            overflow: "hidden",
            boxShadow: "0 20px 50px rgba(0,0,0,0.02)"
          }}
        >
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 100, gap: 20 }}>
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
              <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Retrieving Student Records...</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ borderCollapse: "separate", borderSpacing: "0 0" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "24px 32px" }}>Identification</th>
                    <th>Full Name & Identity</th>
                    <th>Academic Info</th>
                    <th>House Affiliation</th>
                    <th>System Status</th>
                    <th style={{ textAlign: "right", paddingRight: 32 }}>Security Access</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} style={{ transition: "all 0.2s" }} className="student-row">
                      <td style={{ padding: "24px 32px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-subtle)" }}>
                            <GraduationCap size={16} className="text-muted" />
                          </div>
                          <code style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.02em" }}>
                            {s.studentId ?? "—"}
                          </code>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div>
                            <p style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 16 }}>{s.name}</p>
                            {s.nickname && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                <span className="badge" style={{ padding: "2px 8px", background: "var(--bg-elevated)", color: "var(--text-muted)", fontSize: 10 }}>&ldquo;{s.nickname}&rdquo;</span>
                              </div>
                            )}
                          </div>
                          {hasActualMedicalInfo(s) && (
                            <div style={{ color: "#ef4444", animation: "pulse-glow 2s infinite" }} title="Medical Condition">
                              <Activity size={20} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-primary)" }} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>{s.major ?? "N/A"}</span>
                        </div>
                      </td>
                      <td>
                        {s.house ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: s.house.color || "var(--accent-primary)",
                              boxShadow: `0 0 10px ${s.house.color}44`
                            }} />
                            <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{s.house.name}</span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 13 }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        {s.profileCompleted ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10b981" }}>
                            <ShieldCheck size={16} />
                            <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>Verified</span>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-secondary)" }}>
                            <Activity size={16} />
                            <span style={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>Pending</span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", paddingRight: 32 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: 8, borderRadius: 10, color: "var(--text-secondary)" }}
                            onClick={() => setEditingStudent(s)}
                            title="Edit User"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: 8, borderRadius: 10, color: "#ef4444" }}
                            onClick={async () => {
                              if (confirm(`⚠ PERMANENT ACTION: Are you sure you want to delete ${s.name}? This cannot be undone.`)) {
                                const res = await fetch(`/api/admin/users/${s.id}`, { method: "DELETE" });
                                if (res.ok) refreshData();
                                else alert("Failed to delete user. Check permissions.");
                              }
                            }}
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div style={{ width: 1, height: 24, background: "var(--border-subtle)", margin: "0 4px" }} />
                          <button
                            id={`view-sensitive-${s.id}-btn`}
                            className="btn btn-sm"
                            style={{
                              borderRadius: 10,
                              background: "rgba(239,68,68,0.08)",
                              border: "1px solid rgba(239,68,68,0.15)",
                              fontWeight: 700,
                              color: "#ef4444",
                              fontSize: 12,
                              gap: 6
                            }}
                            onClick={() => viewSensitive(s.id)}
                          >
                            <ShieldAlert size={13} /> Medical Log
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 80 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
                            <Search size={32} />
                          </div>
                          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>{search ? "No matches found for your criteria." : "Directory is currently empty."}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sensitive Data Modal */}
      {viewingId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24
          }}
          onClick={() => { setViewingId(null); setSensitiveData(null); }}
        >
          <div
            className="animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: 40,
              padding: 0,
              maxWidth: 600,
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              boxShadow: "0 50px 100px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "32px 40px", borderBottom: "1px solid var(--border-subtle)", background: "linear-gradient(to bottom, var(--bg-surface), var(--bg-elevated))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="badge animate-pulse-glow" style={{ background: "#ef4444", color: "#fff", border: "none", marginBottom: 12 }}>
                    <ShieldAlert size={12} /> SECURE ACCESS
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>Member Health Profile</h2>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ borderRadius: "50%", width: 44, height: 44, padding: 0, background: "var(--bg-elevated)" }}
                  onClick={() => { setViewingId(null); setSensitiveData(null); }}
                >
                  <X size={20} />
                </button>
              </div>

              {loadingSensitive ? (
                <div style={{ height: 20 }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
                    <UserIcon size={24} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 18, color: "var(--text-primary)" }}>{sensitiveData?.name}</p>
                    <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>Member ID: {sensitiveData?.studentId}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "40px" }} className="custom-scrollbar">
              {loadingSensitive ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "40px 0" }}>
                  <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3 }} />
                  <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>Decrypting health records...</p>
                </div>
              ) : sensitiveData && (
                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                  {/* Medical Section */}
                  <div>
                    <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <Heart size={14} style={{ color: "#ef4444" }} /> CLINICAL OBSERVATIONS
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                      {[
                        ["Chronic Diseases", sensitiveData.chronicDiseases],
                        ["Medical History", sensitiveData.medicalHistory],
                        ["Drug Allergies", sensitiveData.drugAllergies],
                        ["Food Allergies", sensitiveData.foodAllergies],
                        ["Dietary Restrictions", sensitiveData.dietaryRestrictions],
                        ["History of Fainting", sensitiveData.faintingHistory ? "YES, Report of Fainting History" : "No known history"],
                      ].map(([label, value]) => (
                        <div key={label as string} style={{ padding: "16px 20px", background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border-subtle)" }}>
                          <p style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</p>
                          <p style={{ fontSize: 15, fontWeight: 600, color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
                            {value || "No records provided"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Emergency Contacts */}
                  <div>
                    <p className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <Phone size={14} style={{ color: "var(--accent-primary)" }} /> EMERGENCY CONTACT PROTOCOL
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {Array.isArray(sensitiveData.emergencyContacts) && sensitiveData.emergencyContacts.length > 0 ? (
                        sensitiveData.emergencyContacts.map((c: any, i: number) => (
                          <div key={i} style={{ padding: "20px", background: "var(--bg-elevated)", borderRadius: 20, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-primary)" }} />
                              <p style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>{c.name}</p>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{c.relationship}</p>
                            <a href={`tel:${c.phone}`} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "var(--accent-primary)", fontWeight: 800, textDecoration: "none", fontSize: 16 }}>
                              <Phone size={16} />
                              {c.phone}
                            </a>
                          </div>
                        ))
                      ) : (
                        <div style={{ gridColumn: "span 2", padding: 32, textAlign: "center", background: "var(--bg-elevated)", borderRadius: 20, border: "1px dashed var(--border-medium)" }}>
                          <p style={{ color: "var(--text-muted)", fontWeight: 600 }}>No emergency contacts listed.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Security Disclaimer */}
                  <div style={{ padding: 20, borderRadius: 20, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)", display: "flex", gap: 16, alignItems: "center" }}>
                    <ShieldAlert size={24} style={{ color: "#ef4444" }} />
                    <p style={{ fontSize: 13, color: "#ef4444", fontWeight: 600, lineHeight: 1.5 }}>
                      SECURITY PROTOCOL: This session has been audited. Unauthorized disclosure of this information is strictly prohibited and subject to institutional discipline.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "24px 40px", background: "var(--bg-elevated)", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" style={{ borderRadius: 12, padding: "12px 32px" }} onClick={() => { setViewingId(null); setSensitiveData(null); }}>Close Records</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingStudent && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }} onClick={() => setEditingStudent(null)}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "100%",
            maxWidth: 500,
            borderRadius: 32,
            overflow: "hidden",
            boxShadow: "0 30px 60px rgba(0,0,0,0.2)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 32, borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 20, fontWeight: 900 }}>Manage User</h3>
              <button className="btn btn-ghost" onClick={() => setEditingStudent(null)} style={{ borderRadius: "50%", width: 40, height: 40, padding: 0 }}><X size={18} /></button>
            </div>
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Full Name</label>
                <input
                  className="input"
                  value={editingStudent.name}
                  onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Student ID</label>
                  <input
                    className="input"
                    value={editingStudent.studentId || ""}
                    onChange={e => setEditingStudent({ ...editingStudent, studentId: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Nickname</label>
                  <input
                    className="input"
                    value={editingStudent.nickname || ""}
                    onChange={e => setEditingStudent({ ...editingStudent, nickname: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>System Role</label>
                  <select
                    className="input"
                    value={editingStudent.role || "student"}
                    onChange={e => setEditingStudent({ ...editingStudent, role: e.target.value })}
                  >
                    <option value="student">Student</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>House</label>
                  <select
                    className="input"
                    value={editingStudent.houseId || ""}
                    onChange={e => setEditingStudent({ ...editingStudent, houseId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {houses.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, display: "block" }}>Major / Program</label>
                <input
                  className="input"
                  value={editingStudent.major || ""}
                  onChange={e => setEditingStudent({ ...editingStudent, major: e.target.value })}
                  placeholder="e.g. SE, ANI, MMIT"
                />
              </div>
            </div>
            <div style={{ padding: "20px 32px", background: "var(--bg-elevated)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setEditingStudent(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={updating}
                onClick={async () => {
                  setUpdating(true);
                  try {
                    const res = await fetch(`/api/admin/users/${editingStudent.id}`, {
                      method: "PATCH",
                      body: JSON.stringify(editingStudent)
                    });
                    if (res.ok) {
                      setEditingStudent(null);
                      refreshData();
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setUpdating(false);
                  }
                }}
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .student-row:hover {
          background: var(--bg-glass);
          cursor: default;
        }
        .student-row:hover .btn-ghost {
          background: var(--bg-surface);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-medium); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
      `}</style>
    </>
  );
}