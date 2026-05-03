"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

type ScanStatus = "success" | "already_checked_in" | "walk_in_required" | "not_found" | "quota_full" | "error";

type ScanResult = {
  status: ScanStatus;
  student?: { name: string; nickname: string; house?: string; houseColor?: string };
  checkedInAt?: string;
  error?: string;
  rawToken?: string;
};

type Event = { id: string; title: string };

export default function QRScannerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [confirmingWalkIn, setConfirmingWalkIn] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState<any[]>([]);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastTokenRef = useRef<string | null>(null);

  // Fetch events for the selector
  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d) && d.length > 0) {
          setEvents(d);
          setEventId(d[0].id);
        }
      });
  }, []);

  // Initialize QR scanner
  useEffect(() => {
    if (!eventId) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { qrbox: { width: 260, height: 260 }, fps: 8 },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        if (lastTokenRef.current === decodedText) return;
        lastTokenRef.current = decodedText;
        scanner.pause();

        const res = await fetch("/api/admin/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken: decodedText, eventId, isWalkIn: false }),
        });
        const data = await res.json();
        setScanResult({ status: data.status ?? (res.ok ? "success" : "error"), ...data, rawToken: decodedText });

        setTimeout(() => {
          setScanResult(null);
          lastTokenRef.current = null;
          try { scanner.resume(); } catch {}
        }, 6000);
      },
      () => {} // Suppress frame errors
    );

    setScannerReady(true);

    return () => {
      try { scanner.clear(); } catch {}
      scannerRef.current = null;
    };
  }, [eventId]);

  const confirmWalkIn = async (token: string) => {
    setConfirmingWalkIn(true);
    const res = await fetch("/api/admin/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: token, eventId, isWalkIn: true }),
    });
    const data = await res.json();
    setScanResult({ status: data.status ?? "error", ...data });
    setConfirmingWalkIn(false);
  };

  const handleManualSearch = async (q: string) => {
    setManualSearch(q);
    if (q.length < 2) { setManualResults([]); return; }
    const res = await fetch(`/api/admin/scan?q=${encodeURIComponent(q)}`);
    if (res.ok) setManualResults(await res.json());
  };

  const manualCheckIn = async (qrToken: string) => {
    setCheckingIn(qrToken);
    const res = await fetch("/api/admin/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken, eventId, isWalkIn: true }),
    });
    const data = await res.json();
    setScanResult({ status: data.status ?? "error", ...data });
    setManualResults([]);
    setManualSearch("");
    setCheckingIn(null);
  };

  const STATUS_CONFIG: Record<ScanStatus, { bg: string; border: string; color: string; icon: string; title: string }> = {
    success:           { bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.3)",   color: "#4ade80", icon: "✓", title: "Check-In Confirmed" },
    already_checked_in:{ bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#f87171", icon: "✕", title: "Already Checked In" },
    walk_in_required:  { bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.3)",   color: "#facc15", icon: "!", title: "Walk-in Required" },
    not_found:         { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#f87171", icon: "?", title: "Student Not Found" },
    quota_full:        { bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.3)",   color: "#facc15", icon: "⚠", title: "Event Full" },
    error:             { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#f87171", icon: "✕", title: "Error" },
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <p className="section-title">Admin Panel</p>
        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>QR Scanner</h1>
      </div>

      {/* Event selector */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: 20,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <label className="label" style={{ margin: 0, whiteSpace: "nowrap" }}>Active Event:</label>
        <select
          id="event-selector"
          className="input"
          style={{ maxWidth: 400 }}
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.length === 0 && <option value="">No events found</option>}
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Left: Scanner + Manual */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            <div id="qr-reader" style={{ width: "100%" }} />
          </div>

          {/* Manual fallback (FE-16) */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: 20,
            }}
          >
            <p className="section-title">Manual Override (FE-16)</p>
            <input
              id="manual-search-input"
              className="input"
              placeholder="Search by name, nickname, or student ID..."
              value={manualSearch}
              onChange={(e) => handleManualSearch(e.target.value)}
            />
            {manualResults.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                {manualResults.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {s.name} <span style={{ color: "var(--text-muted)" }}>({s.nickname})</span>
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.studentId}</p>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={checkingIn === s.qrToken}
                      onClick={() => manualCheckIn(s.qrToken)}
                    >
                      {checkingIn === s.qrToken ? <div className="spinner" /> : "Check In"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Result */}
        <div>
          {scanResult ? (
            (() => {
              const cfg = STATUS_CONFIG[scanResult.status] ?? STATUS_CONFIG.error;
              return (
                <div
                  className="animate-fade-in-up"
                  style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: "var(--radius-lg)",
                    padding: 32,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    height: "100%",
                    minHeight: 280,
                    justifyContent: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: cfg.bg,
                        border: `2px solid ${cfg.color}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        color: cfg.color,
                        fontWeight: 900,
                      }}
                    >
                      {cfg.icon}
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: cfg.color }}>{cfg.title}</h2>
                  </div>

                  {scanResult.student && (
                    <>
                      <p style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
                        {scanResult.student.name}
                        {scanResult.student.nickname && (
                          <span style={{ fontSize: 18, color: "var(--text-secondary)", fontWeight: 600 }}>
                            {" "}({scanResult.student.nickname})
                          </span>
                        )}
                      </p>
                      {scanResult.student.house && (
                        <span
                          className="badge"
                          style={{
                            background: `${scanResult.student.houseColor ?? "var(--accent-primary)"}20`,
                            color: scanResult.student.houseColor ?? "var(--accent-primary)",
                            border: `1px solid ${scanResult.student.houseColor ?? "var(--accent-primary)"}40`,
                            fontSize: 14,
                            padding: "6px 14px",
                            alignSelf: "flex-start",
                          }}
                        >
                          🏠 {scanResult.student.house}
                        </span>
                      )}
                    </>
                  )}

                  {scanResult.checkedInAt && (
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Original check-in: {new Date(scanResult.checkedInAt).toLocaleString()}
                    </p>
                  )}

                  {scanResult.error && (
                    <p style={{ fontSize: 14, color: cfg.color, opacity: 0.85 }}>{scanResult.error}</p>
                  )}

                  {scanResult.status === "walk_in_required" && scanResult.rawToken && (
                    <button
                      id="confirm-walkin-btn"
                      className="btn btn-primary"
                      onClick={() => confirmWalkIn(scanResult.rawToken!)}
                      disabled={confirmingWalkIn}
                      style={{ alignSelf: "flex-start" }}
                    >
                      {confirmingWalkIn ? <><div className="spinner" />Confirming…</> : "✓ Confirm Walk-in (Check Quota)"}
                    </button>
                  )}
                </div>
              );
            })()
          ) : (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "2px dashed var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 280,
                color: "var(--text-muted)",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 48 }}>📷</div>
              <p style={{ fontWeight: 600, fontSize: 15 }}>Waiting for QR scan…</p>
              <p style={{ fontSize: 13 }}>Point camera at a student's Digital ID</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}