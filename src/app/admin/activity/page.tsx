"use client";

import { useEffect, useState } from "react";
import { Trophy, User, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/LanguageContext";

type Activity = 
  | { type: "checkin"; studentName: string; studentId: string; eventTitle: string; timestamp: string }
  | { type: "score"; houseId?: string; houseName: string; houseColor: string; delta: number; reason: string; timestamp: string };

export default function AdminActivityPage() {
  const { t, lang } = useLanguage();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/activity")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setActivities(d); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = activities.filter(a => {
    const q = search.toLowerCase();
    if (a.type === "checkin") {
      return a.studentName.toLowerCase().includes(q) || a.eventTitle.toLowerCase().includes(q) || a.studentId.includes(q);
    } else {
      const houseTranslated = a.houseId === "red" ? t.houseMom : a.houseId === "green" ? t.houseTo : a.houseId === "yellow" ? t.houseLuang : a.houseId === "blue" ? t.houseMakara : a.houseName;
      return houseTranslated.toLowerCase().includes(q) || a.reason.toLowerCase().includes(q);
    }
  });

  return (
    <div className="animate-fade-in-up">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <Link href="/admin/dashboard" className="btn btn-ghost btn-sm" style={{ padding: 8, borderRadius: 12 }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <p className="section-title">{t.adminPanel}</p>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em" }}>{t.fullActivityLogTitle}</h1>
        </div>
      </div>

      <div style={{ marginBottom: 24, position: "relative", maxWidth: 400 }}>
        <Search size={18} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input 
          type="text" 
          placeholder={t.searchActivityPlaceholder} 
          className="input" 
          style={{ paddingLeft: 44 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 80, display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.thTimestamp}</th>
                  <th>{t.thType}</th>
                  <th>{t.thDetails}</th>
                  <th>{t.thValueContext}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>
                        {new Date(a.timestamp).toLocaleTimeString(lang === "th" ? "th-TH" : lang === "cn" ? "zh-CN" : "en-GB", { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {new Date(a.timestamp).toLocaleDateString(lang === "th" ? "th-TH" : lang === "cn" ? "zh-CN" : "en-GB", { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' })}
                      </p>
                    </td>
                    <td>
                      <span className={`badge ${a.type === 'score' ? 'badge-yellow' : 'badge-blue'}`} style={{ gap: 6 }}>
                        {a.type === 'score' ? <Trophy size={12} /> : <User size={12} />}
                        {a.type === 'score' ? t.badgePointAward : t.badgeCheckin}
                      </span>
                    </td>
                    <td>
                      {a.type === 'checkin' ? (
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 14 }}>{a.studentName}</p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{a.studentId}</p>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontWeight: 700, fontSize: 14, color: a.houseColor }}>
                            {a.houseId === "red" ? t.houseMom : a.houseId === "green" ? t.houseTo : a.houseId === "yellow" ? t.houseLuang : a.houseId === "blue" ? t.houseMakara : a.houseName}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.labelManualAdjustment}</p>
                        </div>
                      )}
                    </td>
                    <td>
                      {a.type === 'checkin' ? (
                        <p style={{ fontSize: 13 }}>{t.attended} <b>{a.eventTitle}</b></p>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ 
                            fontSize: 16, 
                            fontWeight: 800, 
                            color: a.delta > 0 ? "#10b981" : "#ef4444" 
                          }}>
                            {a.delta > 0 ? `+${a.delta}` : a.delta} {t.points.toLowerCase()}
                          </span>
                          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>&quot;{a.reason}&quot;</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
                      {t.noActivityRecorded}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
