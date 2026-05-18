"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Calendar,
  CheckCircle,
  RefreshCcw,
  Download,
  Trophy,
  Plus,
  ArrowUpRight
} from "lucide-react";

type DashboardStats = {
  totalUsers: number;
  totalEvents: number;
  checkinsToday: number;
  recentActivity: (
    | { type: "checkin"; studentName: string; studentNickname: string; eventTitle: string; timestamp: string }
    | { type: "score"; houseName: string; houseColor: string; delta: number; reason: string; timestamp: string }
  )[];
  houses: { id: string; name: string; points: number; members: number }[];
};

const HOUSE_GRADIENT: Record<string, string> = {
  "Lanna": "linear-gradient(135deg, #ef4444, #b91c1c)",
  "Mengrai": "linear-gradient(135deg, #14b8a6, #0f766e)",
  "Kawila": "linear-gradient(135deg, #f59e0b, #b45309)",
  "Dara": "linear-gradient(135deg, #6366f1, #4338ca)",
};

export default function AdminDashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchStats = () => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => setStats(d));
  };

  useEffect(() => {
    fetchStats();
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

  const [selectedHouse, setSelectedHouse] = useState<{ id: string; name: string } | null>(null);
  const [scoreForm, setScoreForm] = useState({ delta: "", reason: "" });
  const [submittingScore, setSubmittingScore] = useState(false);

  const handleGiveScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouse || !scoreForm.delta || !scoreForm.reason) return;

    setSubmittingScore(true);
    try {
      const res = await fetch("/api/admin/houses/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseId: selectedHouse.id,
          delta: scoreForm.delta,
          reason: scoreForm.reason
        })
      });

      if (res.ok) {
        // Full re-fetch to ensure activity log is updated too
        fetchStats();
        setSelectedHouse(null);
        setScoreForm({ delta: "", reason: "" });
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update score");
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setSubmittingScore(false);
    }
  };

  const sortedHouses = stats && "houses" in stats && Array.isArray(stats.houses)
    ? [...stats.houses].sort((a, b) => b.points - a.points)
    : [];

  return (
    <div className="animate-fade-in-up">
      {/* House Point Modal Overlay */}
      {selectedHouse && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "clamp(16px, 5vw, 32px)"
        }}>
          <div className="animate-fade-in-up" style={{
            background: "white",
            padding: "clamp(24px, 6vw, 40px)",
            borderRadius: 32,
            width: "100%",
            maxWidth: 480,
            boxShadow: "0 40px 120px rgba(0,0,0,0.25)"
          }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Award Points to {selectedHouse.name}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Enter the amount of points to add (positive) or subtract (negative).</p>
            </div>

            <form onSubmit={handleGiveScore} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="field">
                <label className="label">Point Delta</label>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 50 or -20"
                  required
                  value={scoreForm.delta}
                  onChange={(e) => setScoreForm({ ...scoreForm, delta: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Reason / Activity Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Morning Drill Excellence"
                  required
                  value={scoreForm.reason}
                  onChange={(e) => setScoreForm({ ...scoreForm, reason: e.target.value })}
                />
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => setSelectedHouse(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={submittingScore}
                >
                  {submittingScore ? <div className="spinner" /> : "Confirm Points"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <h1 style={{ fontSize: "clamp(32px,5vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>Dashboard</h1>
        <div className="flex gap-3 flex-wrap">
          <button
            id="refresh-stats-btn"
            className="btn btn-ghost"
            style={{ gap: 8, minHeight: 48, paddingInline: 20, borderRadius: 16 }}
            onClick={() => window.location.reload()}
          >
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button
            id="export-csv-btn"
            className="btn btn-success"
            style={{ gap: 8, minHeight: 48, paddingInline: 24, borderRadius: 99 }}
            onClick={handleExportCSV}
            disabled={exporting}
          >
            {exporting ? <><div className="spinner" />Exporting…</> : <><Download size={16} /> Export CSV</>}
          </button>
        </div>
      </div>

      {(!stats) ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 120, gap: 16 }}>
          <div className="spinner" style={{ width: 40, height: 40 }} />
          <p style={{ color: "var(--text-muted)", fontWeight: 500 }}>Fetching latest analytics...</p>
        </div>
      ) : ("error" in stats) ? (
        <div style={{ padding: 40, background: "rgba(239, 68, 68, 0.1)", borderRadius: 24, textAlign: "center", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          <p style={{ color: "#ef4444", fontWeight: 700 }}>Failed to load dashboard data</p>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 4 }}>{(stats as any).error}</p>
          <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={fetchStats}>Retry</button>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)", padding: 32, position: "relative", overflow: "hidden" }}>
              <Users size={80} style={{ position: "absolute", right: -10, bottom: -10, opacity: 0.03 }} />
              <p className="section-title">Total Students</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <p style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
                  {stats.totalUsers}
                </p>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", gap: 2 }}>
                  <ArrowUpRight size={14} />
                  12%
                </span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>Verified @cmu.ac.th accounts</p>
            </div>

            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)", padding: 32, position: "relative", overflow: "hidden" }}>
              <Calendar size={80} style={{ position: "absolute", right: -10, bottom: -10, opacity: 0.03 }} />
              <p className="section-title">Total Events</p>
              <p style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--accent-primary)" }}>
                {stats.totalEvents}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>Across all categories</p>
            </div>

            <div className="stat-card" style={{ background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)", padding: 32, position: "relative", overflow: "hidden" }}>
              <CheckCircle size={80} style={{ position: "absolute", right: -10, bottom: -10, opacity: 0.03 }} />
              <p className="section-title">Check-ins Today</p>
              <p style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)" }}>
                {stats.checkinsToday}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>Real-time attendance tracking</p>
            </div>
          </div>

          {/* House Leaderboard */}
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 12 }}>
                <Trophy size={24} color="var(--accent-primary)" />
                House Leaderboard
              </h2>
              <div className="badge badge-yellow">Season 1 Active</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {sortedHouses.map((house, idx) => (
                <div
                  key={house.id}
                  className="stat-card"
                  style={{
                    padding: 0,
                    overflow: "hidden",
                    border: idx === 0 ? "1px solid var(--accent-primary)" : "1px solid var(--border-subtle)",
                    boxShadow: idx === 0 ? "0 20px 40px rgba(255,107,0,0.08)" : "none",
                    background: "var(--bg-surface)",
                    position: "relative"
                  }}
                >
                  <div style={{
                    height: 6,
                    background: HOUSE_GRADIENT[house.name] || "var(--accent-primary)"
                  }} />

                  <div style={{ padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 24 }}>{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🏅"}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Rank #{idx + 1}</span>
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{house.name}</h3>

                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, position: "relative" }}>
                      <p style={{
                        fontSize: 42,
                        fontWeight: 900,
                        color: "var(--text-primary)",
                        letterSpacing: "-0.02em"
                      }}>
                        {house.points}
                      </p>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)", marginRight: 8 }}>pts</span>

                      {/* Give Score Button Inline */}
                      <button
                        onClick={() => setSelectedHouse({ id: house.id, name: house.name })}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 12,
                          background: "var(--accent-glow)",
                          border: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "var(--accent-primary)",
                          transition: "all 0.2s",
                          alignSelf: "center",
                          flexShrink: 0
                        }}
                        title="Give points"
                        aria-label={`Award points to ${house.name}`}
                      >
                        <Plus size={18} />
                      </button>
                    </div>

                    <div style={{ marginTop: 20, height: 4, background: "rgba(0,0,0,0.03)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        width: `${(house.points / (sortedHouses[0].points || 1)) * 100}%`,
                        height: "100%",
                        background: HOUSE_GRADIENT[house.name] || "var(--accent-primary)",
                        transition: "width 1s ease-out"
                      }} />
                    </div>

                    <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{house.members} Members</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>{Math.round((house.points / (house.members || 1)) * 10) / 10} avg</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="stat-card" style={{ padding: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800 }}>Recent Activity</h3>
                <Link
                  href="/admin/activity"
                  style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                  className="hover-opacity"
                >
                  View All
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {!stats.recentActivity || stats.recentActivity.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No recent activity.</p>
                ) : (
                  stats.recentActivity.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px", background: "var(--bg-elevated)", borderRadius: 12 }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: a.type === "score" ? `${a.houseColor}20` : "var(--bg-glass)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        color: a.type === "score" ? a.houseColor : "inherit"
                      }}>
                        {a.type === "score" ? <Trophy size={14} /> : "👤"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                          {a.type === "checkin" ? (
                            <><b>{a.studentName}</b> checked in at <b>{a.eventTitle}</b></>
                          ) : (
                            <>
                              <b>{a.houseName}</b> awarded
                              <span style={{
                                margin: "0 4px",
                                color: a.delta > 0 ? "#10b981" : "#ef4444",
                                fontWeight: 800
                              }}>
                                {a.delta > 0 ? `+${a.delta}` : a.delta}
                              </span>
                              pts: <i>"{a.reason}"</i>
                            </>
                          )}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {new Date(a.timestamp).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                            timeZone: 'Asia/Bangkok'
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="stat-card" style={{ padding: 32 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Admin Quick Links</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="/admin/events"
                  className="btn btn-ghost"
                  style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, height: "auto", border: "1px solid var(--border-subtle)", textDecoration: "none", alignItems: "center" }}
                >
                  <Plus size={24} color="var(--accent-primary)" />
                  <span style={{ fontWeight: 700 }}>New Event</span>
                </a>
                <a
                  href="/admin/students"
                  className="btn btn-ghost"
                  style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, height: "auto", border: "1px solid var(--border-subtle)", textDecoration: "none", alignItems: "center" }}
                >
                  <Users size={24} color="var(--accent-primary)" />
                  <span style={{ fontWeight: 700 }}>Manage Students</span>
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>


  );
}