"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Event = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  quota?: number;
  isRegistered?: boolean;
};

const HOUSE_COLORS: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [brightMode, setBrightMode] = useState(false);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setEvents(d); })
      .finally(() => setLoadingEvents(false));
  }, []);

  const handleRegister = async (eventId: string, registered: boolean) => {
    setRegisteringId(eventId);
    const method = registered ? "DELETE" : "POST";
    const res = await fetch(`/api/events/${eventId}/register`, { method });
    if (res.ok) {
      setEvents((evts) =>
        evts.map((e) => (e.id === eventId ? { ...e, isRegistered: !registered } : e))
      );
    }
    setRegisteringId(null);
  };

  const toggleBrightMode = () => {
    setBrightMode((b) => !b);
    // Screen Brightness API (experimental, Chromium only)
    if ("screen" in window && "brightness" in (window.screen as any)) {
      try { (window.screen as any).brightness = brightMode ? 0.5 : 1.0; } catch {}
    }
  };

  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const user = session?.user as any;
  const houseId = user?.houseId ?? null;
  const houseColor = houseId ? (HOUSE_COLORS[houseId] ?? "var(--accent-primary)") : "var(--text-muted)";
  const qrValue = (user as any)?.qrToken ?? user?.id ?? "no-token";

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.endTime) >= now);
  const past = events.filter((e) => new Date(e.endTime) < now);

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      {/* Top Nav */}
      <nav
        style={{
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
          <span className="gradient-text">ActiveCAMT</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user?.image && (
            <img
              src={user.image}
              alt={user.name}
              style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--border-medium)" }}
            />
          )}
          <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            {user?.name?.split(" ")[0]}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <main className="page-container" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Hero row */}
        <section
          className="animate-fade-in-up"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div>
            <p className="section-title">Welcome back</p>
            <h1
              style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}
            >
              {user?.name ?? "Student"}
            </h1>
            <p style={{ color: "var(--text-secondary)", marginTop: 8, fontSize: 15 }}>
              Track your events and house points below.
            </p>
          </div>

          {/* House Badge */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: `1px solid ${houseColor}40`,
              borderRadius: "var(--radius-lg)",
              padding: "20px 28px",
              textAlign: "center",
              boxShadow: `0 0 24px ${houseColor}20`,
              minWidth: 140,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: houseColor,
                marginBottom: 6,
              }}
            >
              Your House
            </p>
            <p
              style={{
                fontSize: 28,
                fontWeight: 900,
                textTransform: "uppercase",
                color: houseColor,
                letterSpacing: "-0.01em",
              }}
            >
              {houseId ?? "—"}
            </p>
          </div>
        </section>

        {/* Main grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 24,
          }}
        >
          {/* Digital ID Card */}
          <div
            className="stat-card animate-fade-in-up"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                alignSelf: "flex-start",
              }}
            >
              Digital ID Card
            </p>

            <div
              style={{
                background: brightMode ? "#fff" : "var(--bg-elevated)",
                padding: 20,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                transition: "background 0.3s",
              }}
            >
              <QRCodeSVG
                value={qrValue}
                size={180}
                level="H"
                bgColor={brightMode ? "#ffffff" : "#1a1e2a"}
                fgColor={brightMode ? "#000000" : "#f0f2f8"}
              />
            </div>

            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {user?.name}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {user?.studentId ?? user?.email}
              </p>
            </div>

            <button
              id="brightness-toggle-btn"
              className={`btn btn-sm ${brightMode ? "btn-ghost" : "btn-primary"} btn-full`}
              onClick={toggleBrightMode}
            >
              {brightMode ? "🌙 Normal Mode" : "☀️ Max Brightness Mode"}
            </button>
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              Show this QR to admin for attendance check-in
            </p>
          </div>

          {/* Events */}
          <div className="stat-card animate-fade-in-up" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="section-title" style={{ margin: 0 }}>Upcoming Events</p>
              <span className="badge badge-purple">{upcoming.length} events</span>
            </div>

            {loadingEvents ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <div className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : upcoming.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "var(--text-muted)",
                  fontSize: 14,
                }}
              >
                No upcoming events right now. Check back soon!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {upcoming.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "16px 18px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      gap: 16,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          color: "var(--text-primary)",
                          marginBottom: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {evt.title}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(evt.startTime).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {evt.location && ` • ${evt.location}`}
                      </p>
                    </div>
                    {evt.isRegistered ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span className="badge badge-green">Registered ✓</span>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRegister(evt.id, true)}
                          disabled={registeringId === evt.id}
                        >
                          {registeringId === evt.id ? <div className="spinner" /> : "Cancel"}
                        </button>
                      </div>
                    ) : (
                      <button
                        id={`register-${evt.id}-btn`}
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRegister(evt.id, false)}
                        disabled={registeringId === evt.id}
                      >
                        {registeringId === evt.id ? <div className="spinner" /> : "1-Click Register"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Past Events */}
            {past.length > 0 && (
              <>
                <div className="divider" style={{ margin: "4px 0" }} />
                <p className="section-title" style={{ margin: 0 }}>Past Events</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {past.slice(0, 3).map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "var(--bg-elevated)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-subtle)",
                        opacity: 0.65,
                      }}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                          {evt.title}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {new Date(evt.startTime).toLocaleDateString("th-TH")}
                        </p>
                      </div>
                      {evt.isRegistered ? (
                        <span className="badge badge-green">Attended ✓</span>
                      ) : (
                        <span className="badge" style={{ background: "var(--bg-glass)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                          Missed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}