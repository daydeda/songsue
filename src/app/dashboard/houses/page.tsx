"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { 
  Trophy, 
  ArrowLeft, 
  Zap, 
  TrendingUp, 
  History,
  Medal,
  Users
} from "lucide-react";
import Link from "next/link";
import { StudentNav } from "@/components/layout/StudentNav";

type House = {
  id: string;
  name: string;
  color: string;
  points: number;
};

type Activity = {
  id: string;
  delta: number;
  reason: string;
  timestamp: string;
  house: { name: string, color: string };
  event?: { title: string };
};

export default function HousesPage() {
  const { t } = useLanguage();
  const [houses, setHouses] = useState<House[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/houses").then(r => r.json()),
      fetch("/api/houses/activity").then(r => r.json())
    ]).then(([hData, aData]) => {
      if (Array.isArray(hData)) setHouses(hData);
      if (Array.isArray(aData)) setActivities(aData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const maxPoints = Math.max(...houses.map(h => h.points), 1);

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh", paddingBottom: 80 }}>
      <StudentNav />

      <main className="page-container" style={{ marginTop: 40 }}>
        {/* Main Leaderboard Cards */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 48 }}>
          {houses.map((h, idx) => (
            <div 
              key={h.id} 
              className="glass" 
              style={{ 
                padding: 32, 
                borderRadius: 32, 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                gap: 20,
                position: "relative",
                overflow: "hidden",
                border: `1px solid ${h.color}20`,
                boxShadow: `0 20px 40px ${h.color}05`
              }}
            >
              {/* Rank Badge */}
              <div style={{ 
                position: "absolute", 
                top: 0, 
                right: 0, 
                width: 64, 
                height: 64, 
                background: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#b45309" : "var(--bg-elevated)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 900,
                borderRadius: "0 0 0 32px"
              }}>
                {idx + 1}
              </div>

              <div style={{ 
                width: 80, 
                height: 80, 
                borderRadius: 24, 
                background: `${h.color}10`, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: h.color,
                boxShadow: `0 10px 20px ${h.color}20`
              }}>
                <Trophy size={40} />
              </div>

              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{h.name}</h2>
                <p style={{ fontSize: 14, fontWeight: 800, color: h.color, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>
                   {h.id === 'red' ? 'Lanna' : h.id === 'green' ? 'Mengrai' : h.id === 'yellow' ? 'Kawila' : 'Dara'} House
                </p>
              </div>

              <div style={{ width: "100%", textAlign: "center" }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: "var(--text-primary)", lineHeight: 1 }}>{h.points}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginTop: 8 }}>{t.points}</div>
              </div>

              <div style={{ width: "100%", height: 8, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${(h.points / maxPoints) * 100}%`, height: "100%", background: h.color, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 32 }}>
          {/* Recent Activity */}
          <section className="glass" style={{ padding: 40, borderRadius: 40 }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
              <History size={24} className="text-accent" />
              {t.recentActivity}
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {activities.map((a) => (
                <div key={a.id} style={{ display: "flex", gap: 20, padding: 20, background: "var(--bg-surface)", borderRadius: 24, border: "1px solid var(--border-subtle)" }}>
                   <div style={{ 
                     width: 48, 
                     height: 48, 
                     borderRadius: 16, 
                     background: `${a.house.color}10`, 
                     display: "flex", 
                     alignItems: "center", 
                     justifyContent: "center",
                     color: a.house.color,
                     flexShrink: 0
                   }}>
                     <Zap size={24} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                       <p style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>{a.reason}</p>
                       <span style={{ 
                         fontSize: 16, 
                         fontWeight: 900, 
                         color: a.delta > 0 ? "#10b981" : "#ef4444" 
                       }}>
                         {a.delta > 0 ? `+${a.delta}` : a.delta}
                       </span>
                     </div>
                     <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                        <span style={{ color: a.house.color }}>{a.house.name}</span>
                        <span>•</span>
                        <span>{a.event?.title || "Special Points"}</span>
                        <span>•</span>
                        <span>{new Date(a.timestamp).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}</span>
                     </div>
                   </div>
                </div>
              ))}
            </div>
          </section>

          {/* Stats & Insights */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div className="glass" style={{ padding: 32, borderRadius: 32, background: "linear-gradient(135deg, var(--accent-primary), #ff9d00)", color: "#fff" }}>
               <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                 <TrendingUp size={20} />
                 House Insight
               </h3>
               <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.9, fontWeight: 500 }}>
                 Currently, <strong>{houses[0]?.name}</strong> is leading the competition. Every event registration and check-in contributes to your house's success!
               </p>
            </div>

            <div className="glass" style={{ padding: 32, borderRadius: 32 }}>
               <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 20 }}>Top Houses</h3>
               <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {houses.slice(0, 3).map((h, i) => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                       <div style={{ width: 32, height: 32, borderRadius: 8, background: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : "#b45309", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14 }}>{i+1}</div>
                       <div style={{ flex: 1 }}>
                         <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{h.name}</span>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>{Math.round((h.points / houses.reduce((acc, curr) => acc + curr.points, 1)) * 100)}%</span>
                         </div>
                         <div style={{ width: "100%", height: 4, background: "var(--bg-elevated)", borderRadius: 2 }}>
                            <div style={{ width: `${(h.points / houses.reduce((acc, curr) => acc + curr.points, 1)) * 100}%`, height: "100%", background: h.color, borderRadius: 2 }} />
                         </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
