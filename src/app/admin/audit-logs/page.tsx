"use client";

import { useEffect, useState } from "react";

type AuditLog = {
  id: string;
  timestamp: string;
  action: string;
  ipAddress?: string;
  actor?: { id: string; name: string; role: string } | null;
  target?: { id: string; name: string; studentId?: string } | null;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLogs(d); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <p className="section-title">Admin Panel</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>Audit Trails</h1>
        </div>
        <span className="badge badge-red">🔒 Immutable Logs</span>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 24, fontSize: 13 }}>
        <span>ℹ️</span>
        <span>
          Every access to sensitive student data (medical records, emergency contacts) is permanently recorded here.
          Logs are <strong>append-only</strong> — no administrator can edit or delete them.
        </span>
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
                  <th>Timestamp</th>
                  <th>Admin Actor</th>
                  <th>Action</th>
                  <th>Target Student</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {new Date(log.timestamp).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(log.timestamp).toLocaleTimeString("en-US")}
                      </p>
                    </td>
                    <td>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                        {log.actor?.name ?? "System"}
                      </p>
                      {log.actor?.role && (
                        <span className="badge badge-purple" style={{ fontSize: 10, marginTop: 4 }}>
                          {log.actor.role}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-red" style={{ fontSize: 11 }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                        {log.target?.name ?? "—"}
                      </p>
                      {log.target?.studentId && (
                        <code style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {log.target.studentId}
                        </code>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {log.ipAddress ?? "—"}
                      </code>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                      No audit logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}