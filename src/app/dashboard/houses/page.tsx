"use client";
 
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { 
  Trophy, 
  Zap, 
  TrendingUp, 
  History,
  Crown
} from "lucide-react";
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
        {/* Header Section */}
        <header className="leaderboard-header animate-fade-in" style={{ marginBottom: 40 }}>
          <h1 className="text-fluid-h1 font-black" style={{ letterSpacing: "-0.04em", margin: 0 }}>
            {t.leaderboard}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 17, fontWeight: 500, marginTop: 8 }}>
            {t.houseRankings}
          </p>
        </header>
 
        {/* Podium for Top 3 */}
        {houses.length >= 3 && (
          <section className="podium-section animate-fade-in-up">
            <div className="podium-container">
              
              {/* 2nd Place */}
              {houses[1] && (
                <div className="podium-card second-place" style={{ borderBottom: `8px solid ${houses[1].color}` }}>
                  <div className="podium-rank-badge rank-second">2</div>
                  <div className="podium-avatar" style={{ background: `${houses[1].color}10`, color: houses[1].color }}>
                    <Trophy size={28} />
                  </div>
                  <h3 className="podium-name">{houses[1].name}</h3>
                  <div className="podium-points">
                    <span className="points-num">{houses[1].points}</span>
                    <span className="points-unit">{t.points}</span>
                  </div>
                </div>
              )}
 
              {/* 1st Place */}
              {houses[0] && (
                <div className="podium-card first-place" style={{ borderBottom: `8px solid ${houses[0].color}` }}>
                  <div className="crown-floating">
                    <Crown size={32} fill="#fbbf24" strokeWidth={1.5} />
                  </div>
                  <div className="podium-rank-badge rank-first">1</div>
                  <div className="podium-avatar" style={{ background: `${houses[0].color}10`, color: houses[0].color, boxShadow: `0 10px 25px ${houses[0].color}25` }}>
                    <Trophy size={36} />
                  </div>
                  <h3 className="podium-name">{houses[0].name}</h3>
                  <div className="podium-points">
                    <span className="points-num highlight-points">{houses[0].points}</span>
                    <span className="points-unit">{t.points}</span>
                  </div>
                </div>
              )}
 
              {/* 3rd Place */}
              {houses[2] && (
                <div className="podium-card third-place" style={{ borderBottom: `8px solid ${houses[2].color}` }}>
                  <div className="podium-rank-badge rank-third">3</div>
                  <div className="podium-avatar" style={{ background: `${houses[2].color}10`, color: houses[2].color }}>
                    <Trophy size={24} />
                  </div>
                  <h3 className="podium-name">{houses[2].name}</h3>
                  <div className="podium-points">
                    <span className="points-num">{houses[2].points}</span>
                    <span className="points-unit">{t.points}</span>
                  </div>
                </div>
              )}
 
            </div>
          </section>
        )}
 
        {/* Full Rankings List */}
        <section className="standings-section animate-fade-in-up" style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 24 }}>Full Standings</h2>
          <div className="standings-list">
            {houses.map((h, idx) => (
              <div className="standings-row" key={h.id}>
                <div className={`standings-rank rank-${idx + 1}`}>
                  {idx + 1}
                </div>
                <div className="standings-avatar" style={{ background: `${h.color}10`, color: h.color }}>
                  <Trophy size={18} />
                </div>
                <div className="standings-info">
                  <span className="standings-name">{h.name}</span>
                  <span className="standings-subtitle" style={{ color: h.color }}>
                    {h.id === 'red' ? 'Lanna' : h.id === 'green' ? 'Mengrai' : h.id === 'yellow' ? 'Kawila' : 'Dara'} House
                  </span>
                </div>
                <div className="standings-progress-container">
                  <div className="standings-progress-bar" style={{ width: `${(h.points / maxPoints) * 100}%`, background: h.color }} />
                </div>
                <div className="standings-points">
                  <span className="points-value">{h.points}</span>
                  <span className="points-label">{t.points}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
 
        {/* Recent Activity */}
        <section className="glass animate-fade-in-up" style={{ padding: 40, borderRadius: 40 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
            <History size={24} className="text-accent" />
            {t.recentActivity}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {activities.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 20, padding: 20, background: "var(--bg-surface)", borderRadius: 24, border: "1px solid var(--border-subtle)", transition: "transform 0.2s ease" }} className="hover-scale">
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
                     <p style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)", display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                       <span>{a.reason}</span>
                       <span style={{ 
                         fontSize: 16, 
                         fontWeight: 900, 
                         color: a.delta > 0 ? "#10b981" : "#ef4444" 
                       }}>
                         {a.delta > 0 ? `+${a.delta}` : a.delta}
                       </span>
                     </p>
                   </div>
                   <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
                      <span style={{ color: a.house.color }}>{a.house.name}</span>
                      <span>•</span>
                      <span>{a.event?.title || "Special Points"}</span>
                      <span>•</span>
                      <span>{new Date(a.timestamp).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })}</span>
                   </div>
                 </div>
              </div>
            ))}
          </div>
        </section>
 
      </main>
 
      <style jsx>{`
        .podium-section {
          margin-bottom: 48px;
        }
        .podium-container {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 24px;
          max-width: 800px;
          margin: 0 auto;
          padding: 32px 0;
        }
        .podium-card {
          flex: 1;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 28px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.02);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .podium-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.06);
        }
        .first-place {
          min-height: 280px;
          z-index: 2;
          background: linear-gradient(180deg, var(--bg-surface) 0%, rgba(251,191,36,0.02) 100%);
          border: 1.5px solid rgba(251,191,36,0.3);
          box-shadow: 0 15px 35px rgba(251,191,36,0.06);
        }
        .second-place {
          min-height: 230px;
          z-index: 1;
          border: 1.5px solid rgba(148,163,184,0.25);
        }
        .third-place {
          min-height: 200px;
          z-index: 0;
          border: 1.5px solid rgba(180,83,9,0.2);
        }
        .crown-floating {
          position: absolute;
          top: -26px;
          left: 50%;
          transform: translateX(-50%);
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translate(-50%, 0px); }
          50% { transform: translate(-50%, -6px); }
        }
        .podium-rank-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 900;
          color: white;
        }
        .rank-first { background: linear-gradient(135deg, #facc15, #eab308); }
        .rank-second { background: linear-gradient(135deg, #cbd5e1, #94a3b8); }
        .rank-third { background: linear-gradient(135deg, #ca8a04, #854d0e); }
        
        .podium-avatar {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .first-place .podium-avatar {
          width: 76px;
          height: 76px;
          border-radius: 24px;
        }
        .podium-name {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
          letter-spacing: -0.02em;
        }
        .podium-points {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .points-num {
          font-size: 28px;
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1;
        }
        .highlight-points {
          font-size: 34px;
          color: var(--text-primary);
          background: linear-gradient(135deg, var(--text-primary), #4b5563);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .points-unit {
          font-size: 9px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 4px;
        }
 
        /* Standings list */
        .standings-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .standings-row {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 16px 24px;
          background: var(--bg-surface);
          border-radius: 20px;
          border: 1px solid var(--border-subtle);
          transition: all 0.2s ease;
        }
        .standings-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          border-color: rgba(255,107,0,0.15);
        }
        .standings-rank {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 14px;
        }
        .standings-rank.rank-1 { background: #fef08a; color: #a16207; }
        .standings-rank.rank-2 { background: #f1f5f9; color: #475569; }
        .standings-rank.rank-3 { background: #ffedd5; color: #9a3412; }
        .standings-rank.rank-4 { background: var(--bg-elevated); color: var(--text-muted); }
 
        .standings-avatar {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .standings-info {
          display: flex;
          flex-direction: column;
          min-width: 120px;
        }
        .standings-name {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-primary);
        }
        .standings-subtitle {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 2px;
        }
        .standings-progress-container {
          flex: 1;
          height: 8px;
          background: var(--bg-elevated);
          border-radius: 4px;
          overflow: hidden;
        }
        .standings-progress-bar {
          height: 100%;
          border-radius: 4px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .standings-points {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          min-width: 80px;
        }
        .points-value {
          font-size: 20px;
          font-weight: 900;
          color: var(--text-primary);
          line-height: 1;
        }
        .points-label {
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-top: 4px;
        }
 
        :global(.hover-scale) {
          transition: all 0.2s ease;
        }
        :global(.hover-scale:hover) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          border-color: rgba(255,107,0,0.15);
        }
 
        @media (max-width: 640px) {
          .podium-container {
            gap: 12px;
            padding: 16px 0;
          }
          .podium-card {
            padding: 16px;
            gap: 12px;
          }
          .first-place { min-height: 220px; }
          .second-place { min-height: 180px; }
          .third-place { min-height: 160px; }
          .crown-floating { top: -22px; }
          .podium-avatar { width: 48px; height: 48px; }
          .first-place .podium-avatar { width: 56px; height: 56px; }
          .podium-name { font-size: 14px; }
          .points-num { font-size: 20px; }
          .highlight-points { font-size: 24px; }
          
          .standings-row {
            padding: 12px 16px;
            gap: 12px;
          }
          .standings-progress-container {
            display: none;
          }
          .standings-info {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
