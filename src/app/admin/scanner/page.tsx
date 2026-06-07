"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
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
import { useLanguage } from "@/lib/LanguageContext";

type ScanStatus = "success" | "success_walk_in" | "pending_confirmation" | "already_checked_in" | "walk_ins_disabled" | "not_found" | "quota_full" | "error";

type ScanResult = {
  status: ScanStatus;
  student?: { 
    name: string; 
    nickname: string; 
    studentId?: string; 
    house?: string; 
    houseColor?: string;
    hasMedicalCondition?: boolean;
    chronicDiseases?: string | null;
    medicalHistory?: string | null;
    drugAllergies?: string | null;
    foodAllergies?: string | null;
    dietaryRestrictions?: string | null;
    faintingHistory?: boolean;
    emergencyMedication?: string | null;
  };
  isWalkIn?: boolean;
  checkedInAt?: string;
  error?: string;
  rawToken?: string;
};

type Event = { id: string; title: string };

export default function QRScannerPage() {
  const { t, lang } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState<{ id: string; name: string; studentId: string; qrToken: string }[]>([]);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [medsCheckOption, setMedsCheckOption] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const eventIdRef = useRef<string>("");
  const isMountedRef = useRef(true);
  const scanSessionIdRef = useRef(0);

  // Manage component mounted lifecycle state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
          if (isMountedRef.current) {
            setEvents(d);
            setEventId(d[0].id);
          }
        }
      });
  }, []);

  const startScanner = async () => {
    if (!isMountedRef.current) return;
    const currentSessionId = ++scanSessionIdRef.current;

    // 1. Clean up any existing instance first
    if (scannerRef.current) {
        try {
            await scannerRef.current.stop();
        } catch {
            // ignore
        }
        scannerRef.current = null;
    }

    // 2. Ensure container is empty and ready
    const container = document.getElementById("qr-reader");
    if (container) {
      container.innerHTML = "";
    } else {
      return;
    }

    // 3. Initialize new instance
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    if (isMountedRef.current) {
      setScannerError(null);
    }

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
            if (isMountedRef.current && currentSessionId === scanSessionIdRef.current) {
              setScanResult(result);
              setShowModal(true);
            }
            if ("vibrate" in navigator) navigator.vibrate(result.status === "success" ? [100, 50, 100] : 200);
          } catch {
            if (isMountedRef.current && currentSessionId === scanSessionIdRef.current) {
              setScanResult({ status: "error", error: "Connection error" });
              setShowModal(true);
            }
          }
        },
        () => {}
      );

      // If component unmounted or another session started while starting, stop the scanner immediately!
      if (!isMountedRef.current || currentSessionId !== scanSessionIdRef.current) {
        try {
          await scanner.stop();
        } catch (stopErr) {
          console.error("Failed to stop scanner after unmount or session change:", stopErr);
        }
        if (currentSessionId === scanSessionIdRef.current) {
          scannerRef.current = null;
        }
        return;
      }

      if (isMountedRef.current) {
        setIsScanning(true);
      }
    } catch (err) {
      console.error("Scanner start error:", err);
      const errorObj = err as Error;
      if (isMountedRef.current && currentSessionId === scanSessionIdRef.current) {
        setScannerError(errorObj?.message || "Could not start camera. Please check permissions.");
        setIsScanning(false);
        scannerRef.current = null;
      }
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (events.length > 0) {
      // Avoid calling setState synchronously inside effect
      timer = setTimeout(() => {
        startScanner();
      }, 0);
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (scannerRef.current) {
        const s = scannerRef.current;
        try {
          s.stop().catch(() => {});
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length > 0]);

  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => {
      if (isMountedRef.current) {
        setScanResult(null);
        lastTokenRef.current = null;
        setMedsCheckOption(null);
      }
    }, 300);
  };

  const confirmAttendance = async (token: string) => {
    setIsConfirming(true);
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          qrToken: token, 
          eventId, 
          action: "confirm",
          medsCheckOption: medsCheckOption || null,
        }),
      });
      const data = await res.json();
      if (isMountedRef.current) {
        setScanResult({ status: data.status ?? (res.ok ? "success" : "error"), ...data, rawToken: token });
      }
      if ("vibrate" in navigator) navigator.vibrate([100, 50, 100]);
    } catch {
      if (isMountedRef.current) {
        setScanResult({ status: "error", error: "Connection error" });
      }
    } finally {
      if (isMountedRef.current) {
        setIsConfirming(false);
      }
    }
  };

  const handleManualSearch = async (q: string) => {
    setManualSearch(q);
    if (q.length < 2) { setManualResults([]); return; }
    try {
      const res = await fetch(`/api/admin/scan?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (isMountedRef.current) {
          setManualResults(data);
        }
      }
    } catch (err) {
      console.error("Manual search error:", err);
    }
  };

  const manualCheckIn = async (qrToken: string) => {
    setCheckingIn(qrToken);
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken, eventId, action: "scan" }),
      });
      const data = await res.json();
      if (isMountedRef.current) {
        setScanResult({ status: data.status ?? (res.ok ? "success" : "error"), ...data, rawToken: qrToken });
        setShowModal(true);
        setManualResults([]);
        setManualSearch("");
      }
    } catch (err) {
      console.error("Manual checkin error:", err);
    } finally {
      if (isMountedRef.current) {
        setCheckingIn(null);
      }
    }
  };

  const STATUS_CONFIG: Record<ScanStatus, { 
    color: string; 
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; fill?: string; className?: string }>; 
    title: string; 
    desc: string;
    bg: string;
  }> = {
    success: { 
      color: "#10b981", 
      icon: UserCheck, 
      title: t.scanSuccess, 
      desc: t.scanSuccess,
      bg: "rgba(16, 185, 129, 0.1)"
    },
    success_walk_in: { 
      color: "#10b981", 
      icon: Zap, 
      title: t.scanSuccess + " (Walk-in)", 
      desc: t.scanSuccess,
      bg: "rgba(16, 185, 129, 0.1)"
    },
    pending_confirmation: { 
      color: "#6366f1", 
      icon: AlertCircle, 
      title: t.manualCheckinTitle, 
      desc: t.manualSearchPlaceholder,
      bg: "rgba(99, 102, 241, 0.1)"
    },
    already_checked_in: { 
      color: "#ef4444", 
      icon: RefreshCcw, 
      title: t.scanAlreadyCheckedIn, 
      desc: t.scanAlreadyCheckedIn,
      bg: "rgba(239, 68, 68, 0.1)"
    },
    walk_ins_disabled: { 
      color: "#f59e0b", 
      icon: UserMinus, 
      title: t.eventDisableFormLabel || "Walk-ins Disabled", 
      desc: t.eventDisableFormLabel || "Walk-ins Disabled",
      bg: "rgba(245, 158, 11, 0.1)"
    },
    not_found: { 
      color: "#ef4444", 
      icon: XCircle, 
      title: t.scanNotFound, 
      desc: t.scanNotFound,
      bg: "rgba(239, 68, 68, 0.1)"
    },
    quota_full: { 
      color: "#f59e0b", 
      icon: Zap, 
      title: t.eventFull || "Event Full", 
      desc: t.eventFull || "Event Full",
      bg: "rgba(245, 158, 11, 0.1)"
    },
    error: { 
      color: "#ef4444", 
      icon: AlertCircle, 
      title: t.scanError, 
      desc: t.scanError,
      bg: "rgba(239, 68, 68, 0.1)"
    },
  };

  let cfg = scanResult ? (STATUS_CONFIG[scanResult.status] || STATUS_CONFIG.error) : null;

  if (cfg && scanResult?.student?.hasMedicalCondition) {
    cfg = {
      ...cfg,
      color: "#ef4444",
      icon: AlertCircle,
      bg: "rgba(239, 68, 68, 0.12)",
      title: lang === "th" ? "คำเตือนด้านสุขภาพ!" : lang === "cn" ? "健康警告！" : lang === "mm" ? "ကျန်းမာရေး သတိပေးချက်!" : "Medical Warning!",
      desc: lang === "th" ? "นักศึกษามีข้อมูลสุขภาพที่ลงทะเบียนไว้ โปรดตรวจสอบข้อมูลยาฉุกเฉินและข้อจำกัดสุขภาพ" : lang === "cn" ? "学生有已记录的健康状况。请核对药品与健康限制。" : lang === "mm" ? "ကျောင်းသားတွင် ကျန်းမာရေးအခြေအနေရှိသည်။ ဆေးဝါးနှင့် ကျန်းမာရေးကန့်သတ်ချက်များကို စစ်ဆေးပါ။" : "Student has a recorded health condition. Please verify medication.",
    };
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-10">
        <h1 style={{ fontSize: "clamp(32px,5vw,48px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1 }}>{t.qrScanner}</h1>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">
        
        {/* Left: Main Scanner Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Event Selector */}
          <div className="stat-card" style={{ padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 48, height: 48, background: "var(--bg-elevated)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={24} color="var(--accent-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" style={{ marginBottom: 4, display: "block", fontSize: 12, color: "var(--text-muted)" }}>{t.eventsTitle.toUpperCase()}</label>
              <select
                className="input"
                style={{ width: "100%", fontSize: 18, fontWeight: 700, padding: "4px 0", border: "none", background: "none" }}
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
              >
                {events.length === 0 && <option value="">{t.noEvents || "No events available"}</option>}
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
                {t.exportCSV ? t.exportCSV.replace(" CSV", "") : "Report"}
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
                <p style={{ fontSize: 14, fontWeight: 600 }}>{t.eventLoadingLabel}</p>
              </div>
            )}

            {scannerError && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.9)", color: "#fff", padding: 40, textAlign: "center" }}>
                <AlertCircle size={48} color="#ef4444" style={{ marginBottom: 16 }} />
                <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.scanError}</p>
                <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24 }}>{scannerError}</p>
                <button 
                    className="btn btn-primary" 
                    style={{ borderRadius: 12 }}
                    onClick={startScanner}
                >
                    <RotateCcw size={16} /> {t.refresh}
                </button>
              </div>
            )}

            {isScanning && (
                <div style={{ position: "absolute", top: 20, left: 20, pointerEvents: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.5)", padding: "6px 12px", borderRadius: 10, backdropFilter: "blur(4px)" }}>
                        <div className="animate-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t.scanningActive}</span>
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
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>{t.manualCheckinTitle}</h3>
            </div>
            
            <div style={{ position: "relative" }}>
              <input
                className="input"
                placeholder={t.manualSearchPlaceholder}
                style={{ paddingLeft: 12 }}
                value={manualSearch}
                onChange={(e) => handleManualSearch(e.target.value)}
              />
            </div>

            {manualResults.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {manualResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => manualCheckIn(s.qrToken)}
                    disabled={checkingIn === s.qrToken}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      minHeight: 64,
                      padding: "12px 16px",
                      background: "var(--bg-elevated)",
                      borderRadius: 16,
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.2s",
                      cursor: "pointer"
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.studentId}</p>
                    </div>
                    <ArrowRight size={18} color="var(--accent-primary)" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="stat-card" style={{ padding: 32, background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)" }}>
             <ShieldCheck size={40} style={{ marginBottom: 16, opacity: 0.2 }} />
             <p style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 700 }}>{t.immutableLogsBadge.replace("🔒 ", "").toUpperCase()}</p>
             <p style={{ fontSize: 15, color: "var(--text-primary)", marginTop: 8, lineHeight: 1.6 }}>
               {t.auditAlertText}
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
              maxHeight: "calc(100vh - 48px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 50px 100px rgba(0,0,0,0.3)",
              border: `1px solid var(--border-subtle)`
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header/Icon */}
            <div style={{ background: cfg.bg, padding: "32px 32px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ 
                width: 72, 
                height: 72, 
                borderRadius: "50%", 
                background: "var(--bg-surface)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: cfg.color,
                boxShadow: `0 10px 30px ${cfg.color}30`,
                border: `4px solid var(--bg-surface)`
              }}>
                <cfg.icon size={36} strokeWidth={3} />
              </div>
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)" }}>{cfg.title}</h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{cfg.desc}</p>
              </div>
            </div>

            {/* Modal Body: Student Info */}
            <div style={{ padding: "24px 32px 32px", overflowY: "auto", flex: 1 }}>
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
                        aka &quot;{scanResult.student.nickname}&quot;
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

                  {scanResult.student.hasMedicalCondition && (
                    <div style={{ 
                      marginTop: 8,
                      padding: 16, 
                      borderRadius: 16, 
                      background: "rgba(239, 68, 68, 0.04)", 
                      border: "1.5px dashed rgba(239, 68, 68, 0.25)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      textAlign: "left"
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <AlertCircle size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {lang === "th" ? "ข้อมูลสุขภาพสำคัญ" : lang === "cn" ? "重要健康信息" : lang === "mm" ? "ကျန်းမာရေး သတိပေးချက်" : "Important Health Information"}
                          </p>
                          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                            {scanResult.student.chronicDiseases && scanResult.student.chronicDiseases !== "-" && scanResult.student.chronicDiseases !== "" && (
                              <p>• <b>{t.chronicDiseases}</b></p>
                            )}
                            {scanResult.student.medicalHistory && scanResult.student.medicalHistory !== "-" && scanResult.student.medicalHistory !== "" && (
                              <p>• <b>{t.medicalHistory}</b></p>
                            )}
                            {scanResult.student.drugAllergies && scanResult.student.drugAllergies !== "-" && scanResult.student.drugAllergies !== "" && (
                              <p>• <b>{t.drugAllergies}</b></p>
                            )}
                            {scanResult.student.foodAllergies && scanResult.student.foodAllergies !== "-" && scanResult.student.foodAllergies !== "" && (
                              <p>• <b>{t.foodAllergies}</b></p>
                            )}
                            {scanResult.student.dietaryRestrictions && scanResult.student.dietaryRestrictions !== "-" && scanResult.student.dietaryRestrictions !== "" && (
                              <p>• <b>{t.dietaryRestrictions}</b></p>
                            )}
                            {scanResult.student.faintingHistory && (
                              <p>• <b>{t.faintingHistory}</b></p>
                            )}
                            {scanResult.student.emergencyMedication && scanResult.student.emergencyMedication !== "-" && scanResult.student.emergencyMedication !== "" && (
                              <p>• <b>{t.emergencyMed}</b></p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Safety Action Selector */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                          {lang === "th" ? "การดำเนินการโดยผู้ดูแล" : lang === "cn" ? "管理员操作选项" : lang === "mm" ? "အက်ဒမင်လုပ်ဆောင်ချက်" : "Admin Security Action"}
                        </p>
                        
                        {/* Option 1: Brought Medication */}
                        <label style={{ 
                           display: "flex", 
                           alignItems: "center", 
                           gap: 10, 
                           padding: "10px 12px", 
                           background: medsCheckOption === "brought" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-elevated)", 
                           borderRadius: 12, 
                           border: medsCheckOption === "brought" ? "1.5px solid #10b981" : "1.5px solid var(--border-subtle)", 
                           cursor: "pointer",
                           userSelect: "none",
                           transition: "all 0.2s"
                        }}>
                          <input 
                            type="radio" 
                            name="meds-check-radio"
                            style={{ width: 16, height: 16, accentColor: "#10b981", cursor: "pointer" }} 
                            checked={medsCheckOption === "brought"}
                            onChange={() => setMedsCheckOption("brought")}
                          />
                          <div style={{ textAlign: "left" }}>
                            <p style={{ fontSize: 12, fontWeight: 800, color: medsCheckOption === "brought" ? "#10b981" : "var(--text-primary)" }}>
                              {lang === "th" ? "พกยาส่วนตัว/ยาฉุกเฉินมาด้วยแล้ว" : lang === "cn" ? "已携带个人/紧急药品" : lang === "mm" ? "ကိုယ်ပိုင်/အရေးပေါ်ဆေးဝါး ယူဆောင်လာပြီး" : "Brought personal/emergency medication"}
                            </p>
                            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                              Brought Medication (Safe check-in)
                            </p>
                          </div>
                        </label>

                        {/* Option 2: Didn't Bring Medication */}
                        <label style={{ 
                           display: "flex", 
                           alignItems: "center", 
                           gap: 10, 
                           padding: "10px 12px", 
                           background: medsCheckOption === "forgot" ? "rgba(245, 158, 11, 0.08)" : "var(--bg-elevated)", 
                           borderRadius: 12, 
                           border: medsCheckOption === "forgot" ? "1.5px solid #f59e0b" : "1.5px solid var(--border-subtle)", 
                           cursor: "pointer",
                           userSelect: "none",
                           transition: "all 0.2s"
                        }}>
                          <input 
                            type="radio" 
                            name="meds-check-radio"
                            style={{ width: 16, height: 16, accentColor: "#f59e0b", cursor: "pointer" }} 
                            checked={medsCheckOption === "forgot"}
                            onChange={() => setMedsCheckOption("forgot")}
                          />
                          <div style={{ textAlign: "left" }}>
                            <p style={{ fontSize: 12, fontWeight: 800, color: medsCheckOption === "forgot" ? "#f59e0b" : "var(--text-primary)" }}>
                              {lang === "th" ? "ไม่ได้พกยามาด้วย / รับทราบความเสี่ยง" : lang === "cn" ? "未携带药品 / 已知悉风险" : lang === "mm" ? "ဆေးဝါးယူမလာပါ / အန္တရာယ်ရှိနိုင်မှုကို သိရှိပြီး" : "Didn't bring medication / Acknowledged risk"}
                            </p>
                            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                              {"Didn't bring medication (Accept risk)"}
                            </p>
                          </div>
                        </label>

                        {/* Option 3: Acknowledge Dietary/Allergies Only */}
                        <label style={{ 
                           display: "flex", 
                           alignItems: "center", 
                           gap: 10, 
                           padding: "10px 12px", 
                           background: medsCheckOption === "acknowledge" ? "rgba(99, 102, 241, 0.08)" : "var(--bg-elevated)", 
                           borderRadius: 12, 
                           border: medsCheckOption === "acknowledge" ? "1.5px solid #6366f1" : "1.5px solid var(--border-subtle)", 
                           cursor: "pointer",
                           userSelect: "none",
                           transition: "all 0.2s"
                        }}>
                          <input 
                            type="radio" 
                            name="meds-check-radio"
                            style={{ width: 16, height: 16, accentColor: "#6366f1", cursor: "pointer" }} 
                            checked={medsCheckOption === "acknowledge"}
                            onChange={() => setMedsCheckOption("acknowledge")}
                          />
                          <div style={{ textAlign: "left" }}>
                            <p style={{ fontSize: 12, fontWeight: 800, color: medsCheckOption === "acknowledge" ? "#6366f1" : "var(--text-primary)" }}>
                              {lang === "th" ? "รับทราบข้อมูล (กรณีข้อจำกัดอาหาร / ข้อมูลทั่วไป)" : lang === "cn" ? "仅确认信息（饮食/过敏限制）" : lang === "mm" ? "အချက်အလက်ကို သိရှိပြီး (အစားအသောက်/ဓာတ်မတည့်မှု ကန့်သတ်ချက်)" : "Acknowledge info only (Dietary/Allergy restrictions)"}
                            </p>
                            <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
                              Acknowledge (For Dietary / Allergies / General info)
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: cfg.color, fontWeight: 700 }}>
                  {scanResult?.error || "Unknown Student"}
                </div>
              )}

              {scanResult?.status === "pending_confirmation" && scanResult.rawToken && (
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => confirmAttendance(scanResult.rawToken!)}
                  disabled={isConfirming || (scanResult?.student?.hasMedicalCondition && !medsCheckOption)}
                  style={{ 
                    marginTop: 24, 
                    background: (scanResult?.student?.hasMedicalCondition && !medsCheckOption) ? "var(--bg-elevated)" : "#6366f1", 
                    color: (scanResult?.student?.hasMedicalCondition && !medsCheckOption) ? "var(--text-muted)" : "white",
                    minHeight: 56, 
                    borderRadius: 16, 
                    fontSize: 16, 
                    fontWeight: 700,
                    opacity: (scanResult?.student?.hasMedicalCondition && !medsCheckOption) ? 0.7 : 1,
                    cursor: (scanResult?.student?.hasMedicalCondition && !medsCheckOption) ? "not-allowed" : "pointer"
                  }}
                >
                  {isConfirming ? (lang === "th" ? "กำลังดำเนินการ..." : lang === "cn" ? "处理中..." : lang === "mm" ? "လုပ်ဆောင်နေသည်..." : "Processing...") : (scanResult?.isWalkIn ? (lang === "th" ? "ยืนยันการเช็คอินแบบ Walk-in" : lang === "cn" ? "确认现场签到" : lang === "mm" ? "Walk-in ချက်အင်ဝင်ခြင်းကို အတည်ပြုရန်" : "Confirm Walk-in Presence") : (lang === "th" ? "ยืนยันการเข้าร่วมกิจกรรม" : lang === "cn" ? "确认到场签到" : lang === "mm" ? "ကိုယ်တိုင်တက်ရောက်မှုကို အတည်ပြုရန်" : "Confirm Physical Presence"))}
                </button>
              )}

              {(scanResult?.status === "success" || scanResult?.status === "success_walk_in" || scanResult?.status === "already_checked_in") && (
                <div 
                  style={{ 
                    marginTop: 24, 
                    padding: 16, 
                    borderRadius: 16, 
                    background: scanResult?.status === "already_checked_in" ? "#3b82f6" : "#10b981", 
                    color: "white", 
                    textAlign: "center",
                    fontWeight: 800,
                    fontSize: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    boxShadow: scanResult?.status === "already_checked_in" ? "0 10px 20px rgba(59, 130, 246, 0.3)" : "0 10px 20px rgba(16, 185, 129, 0.3)"
                  }}
                >
                  <CheckCircle2 size={24} />
                  {scanResult?.status === "already_checked_in" ? t.scanAlreadyCheckedIn : t.attended}
                </div>
              )}

              {(() => {
                const isCloseDisabled = !!(
                  scanResult?.student?.hasMedicalCondition && 
                  !medsCheckOption && 
                  scanResult?.status !== "pending_confirmation"
                );
                return (
                  <button 
                    className="btn btn-ghost btn-full" 
                    onClick={closeModal}
                    disabled={isCloseDisabled}
                    style={{ 
                      marginTop: 12, 
                      minHeight: 52, 
                      borderRadius: 16, 
                      fontSize: 16, 
                      fontWeight: 700,
                      opacity: isCloseDisabled ? 0.5 : 1,
                      cursor: isCloseDisabled ? "not-allowed" : "pointer"
                    }}
                  >
                    {lang === "th" ? "สแกนต่อ" : lang === "cn" ? "继续扫描" : lang === "mm" ? "စကင်ဖတ်ခြင်းကို ဆက်လုပ်ရန်" : "Continue Scanning"}
                  </button>
                );
              })()}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}