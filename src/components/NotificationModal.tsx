"use client";

import { useEffect } from "react";
import { CheckCircle2, Award, ClipboardList, ArrowRight, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { NotifItem } from "@/components/NotificationToasts";

// Auto-dismiss after a few seconds so the modal confirms-then-clears without the
// student having to tap (it can still be dismissed by tap / backdrop / close).
const AUTO_MS = 6000;

/**
 * Center-screen modal pop-up shown the moment staff check a student in or score
 * them — used on the Digital ID page, where the student is holding up their QR.
 * Shows one notification at a time (the parent queue feeds `items`); dismissing
 * the front one reveals the next.
 */
export function NotificationModal({
  items,
  onDismiss,
}: {
  items: NotifItem[];
  onDismiss: (id: string) => void;
}) {
  const { t } = useLanguage();
  const current = items[0];

  useEffect(() => {
    if (!current) return;
    // Confirmations (check-in / score) auto-clear so the student doesn't have to
    // tap. The pre-test reminder is actionable — it stays until they tap the CTA,
    // the close button, or the backdrop, so it can't disappear before they act.
    if (current.type === "pre_test_reminder") return;
    const timer = window.setTimeout(() => onDismiss(current.id), AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [current?.id, current?.type, onDismiss]);

  if (!current) return null;

  const isCheckin = current.type === "checkin";
  const isPreTest = current.type === "pre_test_reminder";
  const positive = (current.points ?? 0) >= 0;
  const accent = isPreTest ? "#e11d48" : isCheckin ? "#14b8a6" : positive ? "var(--accent-primary)" : "#f59e0b";

  const title = isPreTest
    ? t.notifPreTestTitle
    : isCheckin
      ? t.notifCheckinTitle
      : positive
        ? t.notifScorePosTitle
        : t.notifScoreTitle;

  return (
    <div
      onClick={() => onDismiss(current.id)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(92vw, 360px)",
          background: "var(--bg-surface, #fff)",
          color: "var(--text-primary)",
          borderRadius: 28,
          padding: "36px 28px 28px",
          textAlign: "center",
          boxShadow: "0 30px 70px rgba(0,0,0,0.35)",
          border: `1px solid ${accent}33`,
        }}
      >
        <button
          aria-label={t.notifDismiss}
          onClick={() => onDismiss(current.id)}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: 4,
            display: "flex",
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `color-mix(in srgb, ${accent} 16%, transparent)`,
            color: accent,
          }}
        >
          {isPreTest ? (
            <ClipboardList size={46} strokeWidth={2.5} />
          ) : isCheckin ? (
            <CheckCircle2 size={46} strokeWidth={2.5} />
          ) : (
            <Award size={46} strokeWidth={2.5} />
          )}
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>

        {!isCheckin && current.points !== undefined && (
          <div style={{ fontSize: 44, fontWeight: 900, color: accent, lineHeight: 1.1, marginTop: 8 }}>
            {positive ? "+" : ""}
            {current.points}
            <span style={{ fontSize: 16, fontWeight: 800, marginLeft: 6, color: "var(--text-muted)" }}>
              {t.notifPointsSuffix}
            </span>
          </div>
        )}

        {current.eventTitle && (
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginTop: 10,
              wordBreak: "break-word",
            }}
          >
            {current.eventTitle}
          </p>
        )}

        {isPreTest && (
          <p
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            {t.notifPreTestBody}
          </p>
        )}

        {isPreTest && current.link && (
          <a
            href={current.link}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 20,
              padding: "12px 20px",
              borderRadius: 14,
              background: accent,
              color: "white",
              fontSize: 15,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: `0 8px 20px ${accent}40`,
            }}
          >
            {t.notifPreTestCta}
            <ArrowRight size={16} />
          </a>
        )}

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 22 }}>{t.notifTapToClose}</p>
      </div>
    </div>
  );
}
