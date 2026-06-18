"use client";

import { useEffect } from "react";
import { CheckCircle2, Zap, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export type NotifItem = {
  id: string;
  type: "checkin" | "score";
  eventTitle?: string | null;
  points?: number;
};

// How long a toast stays before auto-dismissing.
const DISMISS_MS = 6000;

/**
 * Bottom-center stack of live pop-ups shown to a student when staff check them
 * in or award/deduct their points. Purely presentational: the parent owns the
 * queue (dedup + last-seen bookkeeping) and feeds `items`; each toast auto-expires
 * and can be tapped to dismiss. The container ignores pointer events so it never
 * blocks the page; individual toasts re-enable them for the dismiss button.
 */
export function NotificationToasts({
  items,
  onDismiss,
}: {
  items: NotifItem[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: "min(92vw, 380px)",
        pointerEvents: "none",
      }}
    >
      {items.map((item) => (
        <Toast key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ item, onDismiss }: { item: NotifItem; onDismiss: (id: string) => void }) {
  const { t } = useLanguage();

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  const isCheckin = item.type === "checkin";
  const positive = (item.points ?? 0) >= 0;
  const accent = isCheckin ? "#14b8a6" : positive ? "var(--accent-primary)" : "#f59e0b";

  const title = isCheckin
    ? t.notifCheckinTitle
    : positive
      ? t.notifScorePosTitle
      : t.notifScoreTitle;

  const detail = isCheckin
    ? item.eventTitle ?? ""
    : [
        item.points !== undefined ? `${positive ? "+" : ""}${item.points} ${t.notifPointsSuffix}` : "",
        item.eventTitle ?? "",
      ]
        .filter(Boolean)
        .join(" · ");

  return (
    <div
      className="animate-fade-in-up"
      style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        background: "var(--bg-elevated, #1b1b1f)",
        color: "var(--text-primary, #fff)",
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
        borderLeft: `4px solid ${accent}`,
        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `color-mix(in srgb, ${accent} 18%, transparent)`,
          color: accent,
        }}
      >
        {isCheckin ? <CheckCircle2 size={20} strokeWidth={2.5} /> : <Zap size={20} strokeWidth={2.5} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.01em" }}>{title}</div>
        {detail && (
          <div
            style={{
              fontSize: 13,
              color: "var(--text-muted, rgba(255,255,255,0.65))",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {detail}
          </div>
        )}
      </div>
      <button
        aria-label={t.notifDismiss}
        onClick={() => onDismiss(item.id)}
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "none",
          color: "var(--text-muted, rgba(255,255,255,0.5))",
          cursor: "pointer",
          padding: 4,
          display: "flex",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
