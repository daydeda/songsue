"use client";

import { useEffect, useState } from "react";

type DashboardStats = {
  totalUsers: number;
  totalEvents: number;
  houses: { name: string; points: number; members: number }[];
};

const HOUSE_GRADIENT: Record<string, string> = {
  "Red House":    "linear-gradient(135deg, #ef4444, #dc2626)",
  "Blue House":   "linear-gradient(135deg, #3b82f6, #2563eb)",
  "Green House":  "linear-gradient(135deg, #22c55e, #16a34a)",
  "Yellow House": "linear-gradient(135deg, #eab308, #ca8a04)",
};

export default function AdminDashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => setStats(d));
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    const res = await fetch("/api/admin/dashboard?type=csv");
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activecamt_attendance_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
    setExporting(false);
  };

  const sortedHouses = stats?.houses
    ? [...stats.houses].sort((a, b) => b.points - a.points)
    : [];

  return (
    <div>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <p className="section-title">Admin Panel</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>Overview</h1>
        </div>
        <button
          id="export-csv-btn"
          className="btn btn-success"
          onClick={handleExportCSV}
          disabled={exporting}
        >
          {exporting ? <><div className="spinner" />Exporting…</> : "⬇ Export CSV"}
        </button>
      </div>

      {!stats ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 32 }}>
            <div className="stat-card">
              <p className="section-title">Total Students</p>
              <p style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
                {stats.totalUsers}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Registered accounts</p>
            </div>
            <div className="stat-card">
              <p className="section-title">Active Events</p>
              <p style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.03em", color: "var(--accent-primary)" }}>
                {stats.totalEvents}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Total events created</p>
            </div>
          </div>

          {/* House Leaderboard */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              🏆 House Leaderboard
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {sortedHouses.map((house, idx) => (
                <div
                  key={house.name}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    padding: 24,
                    position: "relative",
                    overflow: "hidden",
                    transition: "transform 0.2s, border-color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  {idx === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: HOUSE_GRADIENT[house.name] ?? "var(--accent-primary)",
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      marginBottom: 4,
                    }}
                  >
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🏅"}
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    {house.name}
                  </p>
                  <p
                    style={{
                      fontSize: 36,
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                      background: HOUSE_GRADIENT[house.name] ?? "var(--accent-primary)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {house.points}
                    <span style={{ fontSize: 14, fontWeight: 600, marginLeft: 4 }}>pts</span>
                  </p>
                  <div className="divider" style={{ margin: "12px 0" }} />
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                      {house.members}
                    </span>{" "}
                    members
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}