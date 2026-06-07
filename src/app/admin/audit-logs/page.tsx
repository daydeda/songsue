"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";

type AuditLog = {
  id: string;
  timestamp: string;
  action: string;
  ipAddress?: string;
  actor?: { id: string; name: string; role: string } | null;
  target?: { id: string; name: string; studentId?: string } | null;
};

export default function AdminAuditLogsPage() {
  const { t, lang } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-logs")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLogs(d); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>{t.auditTrailsTitle}</h1>
        <div className="flex gap-3 items-center flex-wrap">
          <button 
            className="btn btn-ghost" 
            style={{ color: "#ef4444", fontSize: 13, fontWeight: 700, minHeight: 44, paddingInline: 20, borderRadius: 12, border: "1px solid rgba(239,68,68,0.25)" }}
            onClick={async () => {
              if (confirm("⚠ DANGER: Are you sure you want to PERMANENTLY delete all audit logs? This action cannot be undone.")) {
                const res = await fetch("/api/admin/audit-logs", { method: "DELETE" });
                if (res.ok) setLogs([]);
              }
            }}
          >
            {t.resetLogsBtn}
          </button>
          <span className="badge badge-red">{t.immutableLogsBadge}</span>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 24, fontSize: 13 }}>
        <span>ℹ️</span>
        <span>
          {t.auditAlertText}
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
                  <th>{t.thTimestamp}</th>
                  <th>{t.thActor}</th>
                  <th>{t.thAction}</th>
                  <th>{t.thTarget}</th>
                  <th>{t.thIpAddress}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {(() => {
                        const date = new Date(log.timestamp);
                        const locale = lang === "th" ? "th-TH" : lang === "cn" ? "zh-CN" : "en-GB";
                        return (
                          <>
                            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                              {date.toLocaleDateString(locale, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                timeZone: "Asia/Bangkok",
                              })}
                            </p>
                            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              {date.toLocaleTimeString(locale, {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: false,
                                timeZone: "Asia/Bangkok",
                              })}
                            </p>
                          </>
                        );
                      })()}
                    </td>
                    <td>
                      <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>
                        {log.actor?.name ?? "System"}
                      </p>
                      {log.actor?.role && (
                        <span className="badge badge-purple" style={{ fontSize: 10, marginTop: 4 }}>
                          {log.actor.role === "super_admin" ? t.roleSuperAdmin : log.actor.role === "admin" ? t.roleAdmin : log.actor.role === "registration" ? t.roleRegistration : log.actor.role === "organizer" ? t.roleOrganizer : (log.actor.role === "staff" || log.actor.role === "professor" || log.actor.role === "officer") ? t.roleStaff : t.roleStudent}
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
                      {t.noLogsRecorded}
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