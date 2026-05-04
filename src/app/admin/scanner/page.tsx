"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Camera, 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  UserCheck, 
  UserMinus,
  RefreshCcw,
  Zap,
  ArrowRight,
  ShieldCheck,
  House,
  RotateCcw,
  Download
} from "lucide-react";

type ScanStatus = "success" | "success_walk_in" | "pending_confirmation" | "already_checked_in" | "walk_ins_disabled" | "not_found" | "quota_full" | "error";

type ScanResult = {
  status: ScanStatus;
  student?: { name: string; nickname: string; studentId?: string; house?: string; houseColor?: string };
  checkedInAt?: string;
  error?: string;
  rawToken?: string;
};

type Event = { id: string; title: string };

export default function QRScannerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [confirmingWalkIn, setConfirmingWalkIn] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState<any[]>([]);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const eventIdRef = useRef<string>("");

  // Update ref whenever state changes
  useEffect(() => {
    eventIdRef.current = eventId;
  }, [eventId]);

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

  const startScanner = async () => {
    // 1. Clean up any existing instance first
    if (scannerRef.current) {
        try {
            await scannerRef.current.stop();
        } catch (e) {
            // ignore
        }
        scannerRef.current = null;
    }

    // 2. Ensure container is empty and ready
    const container = document.getElementById("qr-reader");
    if (container) container.innerHTML = "";

    // 3. Initialize new instance
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    setScannerError(null);

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        async (decodedText) => {
          if (lastTokenRef.current === decodedText || showModal) return;
          lastTokenRef.current = decodedText;
          
          try {
            const res = await fetch("/api/admin/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                qrToken: decodedText, 
                eventId: eventIdRef.current, 
                action: "scan" 
              }),
            });
            const data = await res.json();
            const result: ScanResult = { 
              status: data.status ?? (res.ok ? "success" : "error"), 
              ...data, 
              rawToken: decodedText 
            };
            setScanResult(result);
            setShowModal(true);
            if ("vibrate" in navigator) navigator.vibrate(result.status === "success" ? [100, 50, 100] : 200);
          } catch (err) {
            setScanResult({ status: "error", error: "Connection error" });
            setShowModal(true);
          }
        },
        () => {}
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner start error:", err);
      setScannerError(err?.message || "Could not start camera. Please check permissions.");
      setIsScanning(false);
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (events.length > 0) {
      startScanner();
    }
    return () => {
      if (scannerRef.current) {
        const s = scannerRef.current;
        // Robust check: try to stop only if it appears to be active
        // and always catch to prevent fatal crashes
        try {
          s.stop().catch(() => {});
        } catch (e) {
          // ignore
        }
      }
    };
  }, [events.length > 0]);

  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => {
      setScanResult(null);
      lastTokenRef.current = null;
    }, 300);
  };

  const confirmAttendance = async (token: string) => {
    setIsConfirming(true);
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token, eventId, action: "confirm" }),
      });
      const data = await res.json();
      setScanResult({ status: data.status ?? (res.ok ? "success" : "error"), ...data, rawToken: token });
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    } catch (err) {
      setScanResult({ status: "error", error: "Connection error" });
    } finally {
      setIsConfirming(false);
    }
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
      body: JSON.stringify({ qrToken, eventId, action: "scan" }),
    });
    const data = await res.json();
    setScanResult({ status: data.status ?? (res.ok ? "success" : "error"), ...data, rawToken: qrToken });
    setShowModal(true);
    setManualResults([]);
    setManualSearch("");
    setCheckingIn(null);
  };

  const STATUS_CONFIG: Record<ScanStatus, { 
    color: string; 
    icon: any; 
    title: string; 
    desc: string;
    bg: string;
  }> = {
    success: { 
      color: "#10b981", 
      icon: UserCheck, 
      title: "Check-In Success", 
      desc: "Student has been checked in successfully.",
      bg: "rgba(16, 185, 129, 0.1)"
    },
    success_walk_in: { 
      color: "#10b981", 
      icon: Zap, 
      title: "Walk-In Registered", 
      desc: "Student was not registered, but has been added as a walk-in.",
      bg: "rgba(16, 185, 129, 0.1)"
    },
    pending_confirmation: { 
      color: "#6366f1", 
      icon: AlertCircle, 
      title: "Verify Presence", 
      desc: "Student is pre-registered. Please confirm physical presence.",
      bg: "rgba(99, 102, 241, 0.1)"
    },
    already_checked_in: { 
      color: "#ef4444", 
      icon: RefreshCcw, 
      title: "Duplicate Check-In", 
      desc: "Student already checked into this event.",
      bg: "rgba(239, 68, 68, 0.1)"
    },
    walk_ins_disabled: { 
      color: "#f59e0b", 
      icon: UserMinus, 
      title: "Walk-ins Disabled", 
      desc: "This event does not allow walk-ins and student is not registered.",
      bg: "rgba(245, 158, 11, 0.1)"
    },
    not_found: { 
      color: "#ef4444", 
      icon: XCircle, 
      title: "Invalid Token", 
      desc: "This QR code is not recognized by the system.",
      bg: "rgba(239, 68, 68, 0.1)"
    },
    quota_full: { 
      color: "#f59e0b", 
      icon: Zap, 
      title: "Event Full", 
      desc: "Maximum capacity reached for this event.",
      bg: "rgba(245, 158, 11, 0.1)"
    },
    error: { 
      color: "#ef4444", 
      icon: AlertCircle, 
      title: "System Error", 
      desc: "An unexpected error occurred. Please try again.",
      bg: "rgba(239, 68, 68, 0.1)"
    },
  };

  const cfg = scanResult ? (STATUS_CONFIG[scanResult.status] || STATUS_CONFIG.error) : null;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-accent-primary" style={{ background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-glow)' }} />
            <p className="section-title" style={{ margin: 0 }}>Attendance System</p>
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 42px)", fontWeight: 900, letterSpacing: "-0.04em" }}>QR Scanner</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8 items-start">
        
        {/* Left: Main Scanner Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Event Selector */}
          <div className="stat-card" style={{ padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 48, height: 48, background: "var(--bg-elevated)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={24} color="var(--accent-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" style={{ marginBottom: 4, display: "block", fontSize: 12, color: "var(--text-muted)" }}>ACTIVE EVENT</label>
              <select
                className="input"
                style={{ width: "100%", fontSize: 18, fontWeight: 700, padding: "4px 0", border: "none", background: "none" }}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                {events.length === 0 && <option value="">No events available</option>}
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            {eventId && (
              <a 
                href={`/api/admin/events/${eventId}/report`}
                download
                className="btn btn-ghost"
                style={{ padding: "8px 16px", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}
              >
                <Download size={16} />
                Report
              </a>
            )}
          </div>

          {/* QR Camera Box */}
          <div
            style={{
              background: "#000",
              borderRadius: "var(--radius-xl)",
              overflow: "hidden",
              border: "8px solid var(--bg-surface)",
              boxShadow: "0 40px 80px rgba(0,0,0,0.15)",
              position: "relative",
              minHeight: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <div id="qr-reader" style={{ width: "100%" }} />
            
            {(!isScanning && !scannerError) && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#000", color: "#fff", gap: 16 }}>
                <div className="spinner" />
                <p style={{ fontSize: 14, fontWeight: 600 }}>Initializing Camera...</p>
              </div>
            )}

            {scannerError && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.9)", color: "#fff", padding: 40, textAlign: "center" }}>
                <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Camera Access Error</p>
                <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>{scannerError}</p>
                <button 
                    className="btn btn-primary" 
                    style={{ borderRadius: 12 }}
                    onClick={startScanner}
                >
                    <RotateCcw size={16} /> Retry Camera
                </button>
              </div>
            )}

            {isScanning && (
                <div style={{ position: "absolute", top: 20, left: 20, pointerEvents: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: 10, backdropFilter: "blur(4px)" }}>
                        <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Scanner Active</span>
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Right: Manual Override & Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="stat-card" style={{ padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <Search size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>Manual Override</h3>
            </div>
            
            <div style={{ position: "relative" }}>
              <input
                className="input"
                placeholder="Name or Student ID..."
                style={{ paddingLeft: 12 }}
                value={manualSearch}
                onChange={(e) => handleManualSearch(e.target.value)}
              />
            </div>

            {manualResults.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {manualResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => manualCheckIn(s.qrToken)}
                    disabled={checkingIn === s.qrToken}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 16,
                      background: "var(--bg-elevated)",
                      borderRadius: 16,
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.2s"
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.studentId}</p>
                    </div>
                    <ArrowRight size={16} color="var(--accent-primary)" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="stat-card" style={{ padding: 32, background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)" }}>
             <ShieldCheck size={40} style={{ marginBottom: 16, opacity: 0.2 }} />
             <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>SESSION SECURITY</p>
             <p style={{ fontSize: 15, color: "var(--text-primary)", marginTop: 8, lineHeight: 1.6 }}>
               System is operating under <b>Secure Mode</b>. All scans are logged with admin timestamps.
             </p>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      {showModal && cfg && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={closeModal}
        >
          <div 
            className="animate-fade-in-up"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-xl)",
              width: "100%",
              maxWidth: 440,
              overflow: "hidden",
              boxShadow: "0 50px 100px rgba(0,0,0,0.3)",
              border: `1px solid var(--border-subtle)`
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header/Icon */}
            <div style={{ background: cfg.bg, padding: "48px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div style={{ 
                width: 80, 
                height: 80, 
                borderRadius: "50%", 
                background: "var(--bg-surface)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: cfg.color,
                boxShadow: `0 10px 30px ${cfg.color}30`,
                border: `4px solid var(--bg-surface)`
              }}>
                <cfg.icon size={40} strokeWidth={3} />
              </div>
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{cfg.title}</h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>{cfg.desc}</p>
              </div>
            </div>

            {/* Modal Body: Student Info */}
            <div style={{ padding: 32 }}>
              {scanResult?.student ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 32, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.04em" }}>
                      {scanResult.student.name}
                    </p>
                    <p style={{ fontSize: 18, color: "var(--text-secondary)", fontWeight: 700, marginTop: 4 }}>
                      {scanResult.student.studentId}
                    </p>
                    {scanResult.student.nickname && (
                      <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600, marginTop: 2 }}>
                        aka "{scanResult.student.nickname}"
                      </p>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                    <div style={{ 
                      padding: "10px 20px", 
                      borderRadius: 12, 
                      background: "var(--bg-elevated)", 
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8
                    }}>
                      <House size={16} color={scanResult.student.houseColor} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: scanResult.student.houseColor }}>
                        {scanResult.student.house}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: cfg.color, fontWeight: 700 }}>
                  {scanResult?.error || "Unknown Student"}
                </div>
              )}

              {scanResult?.status === "pending_confirmation" && scanResult.rawToken && (
                <button
                  className="btn btn-primary btn-full btn-xl"
                  style={{ marginTop: 24, background: "#6366f1" }}
                  onClick={() => confirmAttendance(scanResult.rawToken!)}
                  disabled={isConfirming}
                >
                  {isConfirming ? "Processing..." : "Confirm Physical Presence"}
                </button>
              )}

              {(scanResult?.status === "success" || scanResult?.status === "success_walk_in") && (
                <div 
                  style={{ 
                    marginTop: 24, 
                    padding: 16, 
                    borderRadius: 16, 
                    background: "#10b981", 
                    color: "white", 
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    boxShadow: "0 10px 20px rgba(16, 185, 129, 0.3)"
                  }}
                >
                  <CheckCircle2 size={24} />
                  Confirmed
                </div>
              )}

              <button 
                className="btn btn-ghost btn-full btn-xl" 
                style={{ marginTop: 12 }}
                onClick={closeModal}
              >
                Continue Scanning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}