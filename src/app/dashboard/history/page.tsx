"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { Calendar, History, Trophy, ArrowRight } from "lucide-react";
import { StudentNav } from "@/components/layout/StudentNav";
import Link from "next/link";

export default function HistoryPage() {
  const { t } = useLanguage();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile/history")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setHistory(d); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <StudentNav />

      <main className="page-container" style={{ marginTop: 48, paddingBottom: 100 }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", marginBottom: 12 }}>
            {t.eventHistory}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 18, fontWeight: 500 }}>
            {history.length} events completed in your journey.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : history.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 24 }}>
            {history.map((h) => (
              <div key={h.id} className="glass animate-fade-in-up" style={{ 
                padding: 24, 
                display: "flex", 
                alignItems: "center", 
                gap: 24, 
                borderRadius: 32,
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-surface)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.03)"
              }}>
                <div style={{ width: 80, height: 80, borderRadius: 20, overflow: "hidden", background: "var(--bg-elevated)", flexShrink: 0 }}>
                  {h.eventImageUrl ? (
                    <img src={h.eventImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Calendar size={32} color="var(--text-muted)" />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 900, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{h.eventTitle}</p>
                  <div style={{ 
                    marginTop: 8, 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 6, 
                    padding: "4px 12px", 
                    background: "rgba(255,107,0,0.08)", 
                    borderRadius: 12, 
                    color: "var(--accent-primary)", 
                    fontSize: 13, 
                    fontWeight: 700 
                  }}>
                    <History size={14} />
                    {h.eventQuota 
                      ? t.joinedAsRank.replace("{rank}", h.rank.toString()).replace("{total}", h.eventQuota.toString())
                      : t.joinedAsRankNoLimit.replace("{rank}", h.rank.toString())}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginTop: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Completed on {new Date(h.checkInTime).toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "100px 40px", textAlign: "center", background: "var(--bg-surface)", borderRadius: 40, border: "2px dashed var(--border-subtle)" }}>
             <History size={48} style={{ color: "var(--text-muted)", marginBottom: 20, opacity: 0.3 }} />
             <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>No history yet</h3>
             <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Join your first event to start your activity journey!</p>
             <Link href="/dashboard" className="btn btn-primary">Browse Events</Link>
          </div>
        )}

        {/* Global CSS for page animations */}
        <style jsx global>{`
          .glass:hover {
            transform: translateY(-4px);
            border-color: var(--accent-primary) !important;
            box-shadow: 0 20px 40px rgba(0,0,0,0.06) !important;
          }
        `}</style>
      </main>
    </div>
  );
}
