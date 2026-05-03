"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setStudents(d); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId?.includes(search) ||
      s.nickname?.toLowerCase().includes(search.toLowerCase())
  );

  const viewSensitive = async (id: string) => {
    if (!confirm("⚠ Viewing this student's medical/emergency data will be permanently recorded in the Audit Log. Proceed?")) return;
    setSensitiveData(null);
    setViewingId(id);
    const res = await fetch(`/api/admin/students/${id}`);
    if (res.ok) setSensitiveData(await res.json());
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p className="section-title">Admin Panel</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>Student Directory</h1>
        </div>
        <span className="badge badge-blue">{filtered.length} students</span>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          id="student-search-input"
          className="input"
          style={{ maxWidth: 400 }}
          type="text"
          placeholder="Search by name, nickname, or student ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Major</th>
                  <th>House</th>
                  <th>Status</th>
                  <th>Sensitive Data</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <code style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {s.studentId ?? "—"}
                      </code>
                    </td>
                    <td>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>{s.name}</p>
                      {s.nickname && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>"{s.nickname}"</p>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-purple">{s.major ?? "—"}</span>
                    </td>
                    <td>
                      {s.house ? (
                        <span
                          className="badge"
                          style={{
                            background: `${s.house.color ?? "var(--accent-primary)"}20`,
                            color: s.house.color ?? "var(--accent-primary)",
                            border: `1px solid ${s.house.color ?? "var(--accent-primary)"}40`,
                          }}
                        >
                          {s.house.name}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: "var(--bg-glass)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td>
                      {s.profileCompleted ? (
                        <span className="badge badge-green">Complete</span>
                      ) : (
                        <span className="badge badge-yellow">Pending</span>
                      )}
                    </td>
                    <td>
                      <button
                        id={`view-sensitive-${s.id}-btn`}
                        className="btn btn-danger btn-sm"
                        onClick={() => viewSensitive(s.id)}
                      >
                        🔒 View Medical
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                      {search ? "No students match your search." : "No students registered yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sensitive data modal */}
      {viewingId && sensitiveData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => { setViewingId(null); setSensitiveData(null); }}
        >
          <div
            className="animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-xl)",
              padding: 32,
              maxWidth: 540,
              width: "calc(100% - 32px)",
              boxShadow: "0 32px 64px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
              <div>
                <div
                  className="alert alert-error"
                  style={{ marginBottom: 12, fontSize: 12, padding: "8px 12px" }}
                >
                  <span>🔒</span> This access has been permanently recorded in the Audit Log.
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>
                  Medical & Emergency Info
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                  {sensitiveData.name} ({sensitiveData.studentId})
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setViewingId(null); setSensitiveData(null); }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["Chronic Diseases",     sensitiveData.chronicDiseases],
                ["Medical History",      sensitiveData.medicalHistory],
                ["Drug Allergies",       sensitiveData.drugAllergies],
                ["Food Allergies",       sensitiveData.foodAllergies],
                ["Dietary Restrictions", sensitiveData.dietaryRestrictions],
                ["History of Fainting",  sensitiveData.faintingHistory ? "Yes" : "No"],
              ].map(([label, value]) => (
                <div key={label as string}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                    {(value as string) || "—"}
                  </span>
                </div>
              ))}

              <div className="divider" />
              <p className="section-title">Emergency Contacts</p>
              {Array.isArray(sensitiveData.emergencyContacts) &&
                sensitiveData.emergencyContacts.map((c: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 16px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                      {i + 1}. {c.name}
                      <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12, marginLeft: 8 }}>
                        ({c.relationship})
                      </span>
                    </p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{c.phone}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}