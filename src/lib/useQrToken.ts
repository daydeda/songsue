"use client";

import { useState, useEffect } from "react";

const REFRESH_SECS = 240; // refresh every 4 min; token valid 5 min

export function useQrToken(userId: string | undefined) {
  const [qrValue, setQrValue] = useState<string>("loading");
  const [secsLeft, setSecsLeft] = useState(REFRESH_SECS);

  useEffect(() => {
    if (!userId) return;

    const fetchToken = async () => {
      try {
        const res = await fetch("/api/qr-token");
        if (res.ok) {
          const { token } = await res.json();
          setQrValue(token);
          setSecsLeft(REFRESH_SECS);
        }
      } catch {
        setQrValue(userId);
        setSecsLeft(REFRESH_SECS);
      }
    };

    fetchToken();
    const interval = setInterval(fetchToken, REFRESH_SECS * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  // Countdown ticks every second; resets when qrValue changes
  useEffect(() => {
    if (qrValue === "loading") return;
    const tick = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [qrValue]);

  const countdownMM = String(Math.floor(secsLeft / 60)).padStart(2, "0");
  const countdownSS = String(secsLeft % 60).padStart(2, "0");
  const countdownColor =
    secsLeft > 60 ? "#22c55e" : secsLeft > 30 ? "#f59e0b" : "#ef4444";

  return { qrValue, secsLeft, countdownMM, countdownSS, countdownColor };
}
