"use client";

import { StudentNav } from "@/components/layout/StudentNav";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Swords, Camera, AlertTriangle, ArrowLeft, Loader2, CameraOff } from "lucide-react";
import Link from "next/link";

interface JoinClientProps {
  initialSession: any;
}

export function JoinClient({ initialSession }: JoinClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryRoom = searchParams.get("room") || "";

  const [code, setCode] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, []);

  // Pre-fill room code if provided in query URL
  useEffect(() => {
    if (queryRoom && queryRoom.length === 4) {
      const chars = queryRoom.toUpperCase().split("");
      setCode(chars);
      handleJoinRoom(queryRoom.toUpperCase());
    }
  }, [queryRoom]);

  // Handles input typing inside the character blocks
  const handleInputChange = (index: number, val: string) => {
    const newVal = val.toUpperCase().replace(/[^A-Z2-9]/g, ""); // Filter to allowed characters
    if (!newVal) {
      const nextCode = [...code];
      nextCode[index] = "";
      setCode(nextCode);
      return;
    }

    const nextCode = [...code];
    nextCode[index] = newVal[newVal.length - 1]; // Use last char typed
    setCode(nextCode);

    // Auto-focus next input
    if (index < 3 && newVal.length > 0) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit if full
    const fullCode = nextCode.join("");
    if (fullCode.length === 4 && index === 3) {
      handleJoinRoom(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace: clear and move back
    if (e.key === "Backspace") {
      if (code[index] === "" && index > 0) {
        const nextCode = [...code];
        nextCode[index - 1] = "";
        setCode(nextCode);
        inputRefs[index - 1].current?.focus();
      } else {
        const nextCode = [...code];
        nextCode[index] = "";
        setCode(nextCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text").trim().toUpperCase();
    if (pastedText.length >= 4) {
      const cleanText = pastedText.replace(/[^A-Z2-9]/g, "").substring(0, 4);
      if (cleanText.length === 4) {
        const chars = cleanText.split("");
        setCode(chars);
        handleJoinRoom(cleanText);
      }
    }
  };

  const handleJoinRoom = async (roomCode: string) => {
    if (roomCode.length !== 4) return;
    setLoading(true);
    setError(null);
    stopScanner();

    try {
      const res = await fetch(`/api/battle/rooms/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to join room");
      }

      router.push(`/battle/room/${roomCode}`);
    } catch (err: any) {
      setError(err.message || "Could not join the room");
      setLoading(false);
    }
  };

  // WebRTC QR Scanner logic
  const startScanner = async () => {
    setError(null);
    setScannerError(null);
    setIsScanning(true);

    // Clean up existing
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }

    const container = document.getElementById("join-qr-reader");
    if (container) container.innerHTML = "";

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setScannerError("Camera not available or blocked. HTTPS/localhost is required.");
      setIsScanning(false);
      return;
    }

    const scanner = new Html5Qrcode("join-qr-reader");
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          // Parse url
          try {
            const url = new URL(decodedText);
            const roomVal = url.searchParams.get("room");
            if (roomVal && roomVal.length === 4) {
              stopScanner();
              const chars = roomVal.toUpperCase().split("");
              setCode(chars);
              handleJoinRoom(roomVal.toUpperCase());
            } else {
              setScannerError("Invalid QR Code content. Make sure it's an ActiveCAMT battle QR code.");
            }
          } catch {
            // Not a URL, try if it is a 4-letter code
            const cleanText = decodedText.trim().toUpperCase().replace(/[^A-Z2-9]/g, "");
            if (cleanText.length === 4) {
              stopScanner();
              const chars = cleanText.split("");
              setCode(chars);
              handleJoinRoom(cleanText);
            } else {
              setScannerError("Could not read room code from QR.");
            }
          }
        },
        () => {}
      );
    } catch (err: any) {
      console.error(err);
      let msg = "Could not initialize camera scanner.";
      if (err.name === "NotAllowedError" || /permission/i.test(err.message)) {
        msg = "Camera permission denied. Please allow camera access in browser settings.";
      }
      setScannerError(msg);
      setIsScanning(false);
      scannerRef.current = null;
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const currentCode = code.join("");

  return (
    <>
      <StudentNav />

      <main style={{ padding: "80px max(16px, env(safe-area-inset-right)) 80px max(16px, env(safe-area-inset-left))", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        {/* Back Button */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/battle" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--text-secondary)", fontWeight: 600, fontSize: 14 }}>
            <ArrowLeft size={16} /> กลับอารีน่า
          </Link>
        </div>

        {/* Card Panel */}
        <div className="glass" style={{ padding: 40, border: "1px solid var(--border-medium)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", marginBottom: 16 }}>
              <Swords size={28} />
            </div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 900, marginBottom: 8, letterSpacing: "-0.03em" }}>
              เข้าร่วมห้องประลอง
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              พิมพ์รหัสห้อง 4 หลัก หรือสแกน QR Code เพื่อเชื่อมต่อกับเพื่อนผู้ท้าชิง
            </p>
          </div>

          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* 4 Block Input */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>พิมพ์รหัสห้อง (Room Code)</label>
              
              <div style={{ display: "flex", gap: 12 }}>
                {code.map((char, index) => (
                  <input
                    key={index}
                    ref={inputRefs[index]}
                    type="text"
                    maxLength={1}
                    value={char}
                    onChange={(e) => handleInputChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    disabled={loading}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "var(--radius-md)",
                      border: "2px solid var(--border-medium)",
                      fontSize: 24,
                      fontWeight: 900,
                      textAlign: "center",
                      textTransform: "uppercase",
                      outline: "none",
                      background: "var(--bg-elevated)",
                      transition: "border-color 0.15s, box-shadow 0.15s",
                      boxShadow: char ? "0 0 0 2px var(--accent-glow)" : "none",
                      borderColor: char ? "var(--accent-primary)" : "var(--border-medium)",
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", padding: "12px 16px", borderRadius: "var(--radius-md)", color: "#991b1b", display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={18} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{error}</span>
              </div>
            )}

            {/* Join Button */}
            <button
              className="btn"
              disabled={loading || currentCode.length !== 4}
              onClick={() => handleJoinRoom(currentCode)}
              style={{
                background: currentCode.length === 4 ? "var(--accent-primary)" : "var(--text-muted)",
                color: "#fff",
                height: 52,
                fontSize: 16,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="spinner" size={20} />
                  กำลังเข้าร่วม...
                </>
              ) : (
                "เข้าร่วมห้องประลอง"
              )}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
              <div style={{ flexGrow: 1, height: 1, background: "var(--border-subtle)" }}></div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>หรือ</span>
              <div style={{ flexGrow: 1, height: 1, background: "var(--border-subtle)" }}></div>
            </div>

            {/* Scan Camera Area */}
            {!isScanning ? (
              <button
                className="btn"
                onClick={startScanner}
                disabled={loading}
                style={{
                  border: "2px solid var(--border-medium)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  height: 48,
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <Camera size={18} />
                สแกน QR Code ด้วยกล้อง
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
                <div 
                  id="join-qr-reader" 
                  style={{ 
                    width: "100%", 
                    maxWidth: 320, 
                    borderRadius: "var(--radius-lg)", 
                    overflow: "hidden", 
                    border: "2px solid var(--accent-primary)",
                    background: "#000"
                  }}
                ></div>
                
                {scannerError && (
                  <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "10px 12px", borderRadius: "var(--radius-md)", color: "#b45309", fontSize: 13 }}>
                    {scannerError}
                  </div>
                )}

                <button
                  className="btn"
                  onClick={stopScanner}
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    height: 40,
                    fontSize: 13,
                    padding: "0 16px"
                  }}
                >
                  <CameraOff size={16} style={{ marginRight: 6 }} />
                  ปิดกล้องสแกน
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
