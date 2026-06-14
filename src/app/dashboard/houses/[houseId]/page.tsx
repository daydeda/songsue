"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Users, Trophy, ShieldAlert, Crown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { StudentNav } from "@/components/layout/StudentNav";

// House mascot logos, keyed by house id (color) and name — mirrors the leaderboard
// page so the same artwork resolves whichever identifier the API returns.
const HOUSE_LOGOS: Record<string, string> = {
  red: "/house_logo/mom.png",    mom: "/house_logo/mom.png",
  green: "/house_logo/to.png",   to: "/house_logo/to.png",
  yellow: "/house_logo/luang.png", luang: "/house_logo/luang.png",
  blue: "/house_logo/makon.png", makara: "/house_logo/makon.png", makon: "/house_logo/makon.png",
};
const houseLogo = (idOrName?: string | null): string | null =>
  idOrName ? HOUSE_LOGOS[idOrName.toLowerCase()] ?? null : null;

type House = { id: string; name: string; color: string; points: number };
type Member = { id: string; name: string; nickname: string | null; points: number };

export default function HouseMembersPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const params = useParams();
  const houseId = String(params.houseId);

  const [house, setHouse] = useState<House | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  // 403 → trying to view a house that isn't yours; anything else → generic failure.
  const [error, setError] = useState<"forbidden" | "other" | null>(null);

  const getTranslatedHouseName = (idOrName: string, defaultName: string) => {
    const key = idOrName.toLowerCase();
    if (key === "red" || key === "mom") return t.houseMom || "Mom";
    if (key === "green" || key === "to") return t.houseTo || "To";
    if (key === "yellow" || key === "luang") return t.houseLuang || "Luang";
    if (key === "blue" || key === "makara") return t.houseMakara || "Makon";
    return defaultName;
  };

  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/houses/${houseId}/members`, { signal: ac.signal })
      .then(async (r) => {
        if (r.status === 403) { setError("forbidden"); return null; }
        if (!r.ok) { setError("other"); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setHouse(data.house);
          setMembers(data.members ?? []);
        }
      })
      .catch((e) => { if (e.name !== "AbortError") setError("other"); })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [houseId]);

  if (loading) {
    return (
      <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
        <StudentNav />
        <div className="min-h-screen flex items-center justify-center">
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      </div>
    );
  }

  if (error || !house) {
    return (
      <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
        <StudentNav />
        <main className="page-container" style={{ marginTop: 40 }}>
          <div className="notice-card">
            <ShieldAlert size={40} style={{ color: "var(--text-muted)" }} />
            <p>{error === "forbidden" ? t.membersOwnHouseOnly : "Something went wrong."}</p>
          </div>
        </main>
        <style jsx>{noticeStyles}</style>
      </div>
    );
  }

  const color = house.color || "var(--accent-primary)";
  const displayName = getTranslatedHouseName(house.id, house.name);
  const logo = houseLogo(house.id);
  const maxPoints = Math.max(...members.map((m) => m.points), 1);

  const podium = members.slice(0, 3);
  const rest = members.slice(3);
  // Podium visual order: 2nd, 1st, 3rd (center-tallest), matching the leaderboard.
  const podiumOrder = [podium[1], podium[0], podium[2]];
  const placeClass = ["second-place", "first-place", "third-place"];
  const rankNum = [2, 1, 3];

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh", paddingBottom: 80 }}>
      <StudentNav />

      <main className="page-container" style={{ marginTop: 32 }}>
        {/* Hero banner — house colour wash + mascot */}
        <header
          className="house-hero"
          style={{
            background: `linear-gradient(135deg, ${color}1f 0%, ${color}08 55%, var(--bg-surface) 100%)`,
            borderColor: `${color}40`,
          }}
        >
          <div className="hero-glow" style={{ background: color }} />
          <div className="hero-avatar" style={{ background: `${color}14`, boxShadow: `0 16px 40px ${color}33` }}>
            {logo ? <img src={logo} alt="" className="hero-logo-img" /> : <Trophy size={48} style={{ color }} />}
          </div>
          <div className="hero-meta">
            <span className="hero-eyebrow" style={{ color }}>{t.houseMembers}</span>
            <h1 className="hero-name">{displayName}</h1>
            <div className="hero-stats">
              <span className="hero-chip" style={{ borderColor: `${color}40`, color }}>
                <Users size={16} /> {members.length} {t.membersCount}
              </span>
              <span className="hero-chip" style={{ borderColor: `${color}40`, color }}>
                <Trophy size={16} /> {house.points} {t.points}
              </span>
            </div>
          </div>
        </header>

        {/* Podium — top 3 members */}
        {podium.length > 0 && (
          <section className="podium-section">
            <div className="podium-container">
              {podiumOrder.map((m, i) => {
                if (!m) return null;
                const isMe = m.id === myId;
                return (
                  <div
                    key={m.id}
                    className={`podium-card ${placeClass[i]}`}
                    style={{ borderBottom: `8px solid ${color}` }}
                  >
                    {rankNum[i] === 1 && (
                      <div className="crown-floating"><Crown size={30} fill="#fbbf24" strokeWidth={1.5} /></div>
                    )}
                    <div className={`podium-rank-badge rank-${rankNum[i]}`}>{rankNum[i]}</div>
                    <h3 className="podium-name">
                      {m.name}
                      {m.nickname && <span className="podium-nick">({m.nickname})</span>}
                      {isMe && <span className="you-badge">{t.you || "YOU"}</span>}
                    </h3>
                    <div className="podium-points">
                      <span className="points-num" style={rankNum[i] === 1 ? { color } : undefined}>{m.points}</span>
                      <span className="points-unit">{t.points}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Remaining members */}
        {rest.length > 0 && (
          <section style={{ marginTop: 8 }}>
            <div className="member-list">
              {rest.map((m, idx) => {
                const rank = idx + 4;
                const isMe = m.id === myId;
                return (
                  <div className={`member-row${isMe ? " is-me" : ""}`} key={m.id}>
                    <div className="member-rank">{rank}</div>
                    <div className="member-info">
                      <span className="member-name">
                        {m.name} {m.nickname ? <span className="member-nick">({m.nickname})</span> : null}
                        {isMe && <span className="you-badge">{t.you || "YOU"}</span>}
                      </span>
                    </div>
                    <div className="member-progress">
                      <div className="member-bar" style={{ width: `${(m.points / maxPoints) * 100}%`, background: color }} />
                    </div>
                    <div className="member-points">
                      <span className="points-value">{m.points}</span>
                      <span className="points-label">{t.points}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {members.length === 0 && <div className="empty-state">{t.noMembersYet}</div>}
      </main>

      <style jsx>{`
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          margin-bottom: 20px;
          transition: color 0.2s;
        }
        .back-link:hover { color: var(--accent-primary); }

        /* Hero */
        .house-hero {
          position: relative;
          display: flex;
          align-items: center;
          gap: 24px;
          border: 1px solid var(--border-subtle);
          border-radius: 28px;
          padding: 32px;
          overflow: hidden;
          margin-bottom: 40px;
        }
        .hero-glow {
          position: absolute;
          top: -60px;
          right: -40px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
          pointer-events: none;
        }
        .hero-avatar {
          width: 104px;
          height: 104px;
          border-radius: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          z-index: 1;
        }
        .hero-logo-img { width: 84%; height: 84%; object-fit: contain; }
        .hero-meta { z-index: 1; min-width: 0; }
        .hero-eyebrow {
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .hero-name {
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 900;
          letter-spacing: -0.04em;
          margin: 6px 0 14px;
          line-height: 1;
        }
        .hero-stats { display: flex; gap: 10px; flex-wrap: wrap; }
        .hero-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 14px;
          font-weight: 800;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid;
          background: var(--bg-surface);
        }

        /* Podium (mirrors the leaderboard) */
        .podium-section { margin-bottom: 40px; }
        .podium-container {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 20px;
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 0;
        }
        .podium-card {
          flex: 1;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 26px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.02);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .podium-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.06); }
        .first-place { min-height: 210px; z-index: 2; }
        .second-place, .third-place { min-height: 180px; }
        .crown-floating {
          position: absolute;
          top: -22px;
          left: 50%;
          transform: translateX(-50%);
          animation: float 3s ease-in-out infinite;
        }
        @keyframes float { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-6px); } }
        .podium-rank-badge {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
          color: #fff;
        }
        .rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); }
        .rank-2 { background: linear-gradient(135deg, #cbd5e1, #94a3b8); }
        .rank-3 { background: linear-gradient(135deg, #d6a06a, #b45309); }
        .podium-name {
          font-size: 15px;
          font-weight: 800;
          text-align: center;
          margin: 0;
          line-height: 1.35;
        }
        .podium-nick { display: block; font-size: 12px; color: var(--text-muted); font-weight: 600; }
        .podium-points { display: flex; flex-direction: column; align-items: center; }
        .points-num { font-size: 26px; font-weight: 900; line-height: 1; }
        .first-place .points-num { font-size: 30px; }
        .points-unit { font-size: 11px; color: var(--text-muted); font-weight: 700; margin-top: 2px; }

        /* List */
        .member-list { display: flex; flex-direction: column; gap: 10px; }
        .member-row {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 18px;
          padding: 14px 20px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .member-row:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,0.04); }
        .member-row.is-me {
          border-color: var(--accent-primary);
          background: rgba(255,107,0,0.05);
          box-shadow: 0 0 0 1px var(--accent-primary), 0 8px 24px rgba(255,107,0,0.08);
        }
        .member-rank {
          width: 28px;
          text-align: center;
          font-weight: 900;
          font-size: 15px;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .member-info { flex: 2; min-width: 0; }
        .member-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .member-nick { color: var(--text-muted); font-weight: 600; }
        .member-progress {
          flex: 3;
          height: 8px;
          background: var(--bg-elevated);
          border-radius: 999px;
          overflow: hidden;
        }
        .member-bar { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
        .member-points { text-align: right; flex-shrink: 0; min-width: 64px; }
        .points-value { display: block; font-size: 16px; font-weight: 900; color: var(--text-primary); }
        .points-label { font-size: 11px; color: var(--text-muted); font-weight: 600; }
        .you-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 8px;
          border-radius: 999px;
          background: var(--accent-primary);
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          vertical-align: middle;
        }
        .empty-state {
          text-align: center;
          padding: 48px 20px;
          color: var(--text-muted);
          font-size: 15px;
          font-weight: 600;
        }

        @media (max-width: 640px) {
          .house-hero { flex-direction: column; text-align: center; padding: 28px 20px; gap: 16px; }
          .hero-stats { justify-content: center; }
          .hero-avatar { width: 88px; height: 88px; }
          .podium-container { gap: 10px; padding: 24px 0 8px; }
          .podium-card { padding: 16px 10px; border-radius: 20px; }
          .first-place { min-height: 210px; }
          .second-place, .third-place { min-height: 180px; }
          .podium-name { font-size: 13px; }
          .points-num { font-size: 22px; }
          .first-place .points-num { font-size: 26px; }
          .member-progress { display: none; }
        }
      `}</style>
    </div>
  );
}

const noticeStyles = `
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
    margin-bottom: 24px;
    transition: color 0.2s;
  }
  .back-link:hover { color: var(--accent-primary); }
  .notice-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding: 56px 24px;
    color: var(--text-secondary);
    font-size: 16px;
    font-weight: 600;
  }
`;
