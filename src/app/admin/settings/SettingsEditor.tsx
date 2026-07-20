"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, Copy, AlertTriangle, Check } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function SettingsEditor() {
  const { t } = useLanguage();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.previewAccessToken === "string") setToken(d.previewAccessToken);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewAccessToken: token.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Failed to save");
      }
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/preview?token=${encodeURIComponent(token.trim())}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "clamp(28px,5vw,42px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 12 }}>
          <KeyRound size={32} strokeWidth={2.5} style={{ color: "var(--accent-primary)" }} />
          {t.manageSettings}
        </h1>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          width: "100%",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <div className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : (
          <>
            <label style={{ display: "block", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              {t.previewAccessTokenLabel}
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t.previewAccessTokenPlaceholder}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setToken(crypto.randomUUID().replace(/-/g, "").slice(0, 24))}
                style={{ fontSize: 12, padding: "8px 12px", whiteSpace: "nowrap" }}
              >
                {t.generatePreviewToken}
              </button>
            </div>

            {token.trim() && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={copyLink}
                style={{ fontSize: 11, padding: "6px 10px", marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Copy size={14} />
                {copied ? t.previewLinkCopied : t.copyPreviewLink}
              </button>
            )}

            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
              {t.previewAccessTokenHint}
            </p>

            {error && (
              <div className="alert alert-error" style={{ marginTop: 20, fontSize: 13 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28 }}>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Save size={18} />
                {saving ? t.saving : t.saveChanges}
              </button>
              {savedAt && !saving && (
                <span style={{ fontSize: 13, color: "var(--accent-success, #16a34a)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Check size={14} style={{ flexShrink: 0 }} /> {t.announcementSaved}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
