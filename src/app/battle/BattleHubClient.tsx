"use client";

import { StudentNav } from "@/components/layout/StudentNav";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Swords, Trophy, History, Play, Users, Medal, Zap, RotateCcw, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string;
  roles?: string[];
  houseId?: string | null;
  studentId?: string | null;
}

interface BattleHubClientProps {
  initialSession: { user: SessionUser } | null;
}

interface Stats {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestStreak: number;
  totalGames: number;
}

interface MatchHistoryItem {
  id: string;
  roomCode: string;
  gameType: string;
  status: string;
  hostId: string;
  guestId: string;
  winnerId: string | null;
  finishReason: string | null;
  updatedAt: string;
  host: { id: string; name: string; nickname: string | null; houseId: string | null };
  guest: { id: string; name: string; nickname: string | null; houseId: string | null } | null;
}

interface LeaderboardItem {
  id: string;
  userId: string;
  wins: number;
  winStreak: number;
  bestStreak: number;
  user: { id: string; name: string; nickname: string | null; houseId: string | null; image: string | null };
}

export function BattleHubClient({ initialSession }: BattleHubClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"leaderboard" | "history">("leaderboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = initialSession?.user;

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch stats and history
        const statsRes = await fetch("/api/battle/stats/me");
        if (!statsRes.ok) throw new Error("Failed to load statistics");
        const statsData = await statsRes.json();
        setStats(statsData.stats);
        setHistory(statsData.history);

        // Fetch leaderboard
        const lbRes = await fetch("/api/battle/leaderboard?game=ox");
        if (!lbRes.ok) throw new Error("Failed to load leaderboard");
        const lbData = await lbRes.json();
        setLeaderboard(lbData.leaderboard);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleCreateRoom() {
    try {
      setCreating(true);
      setError(null);
      const res = await fetch("/api/battle/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "ox" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create room");
      }

      const room = await res.json();
      router.push(`/battle/room/${room.roomCode}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create room");
      setCreating(false);
    }
  }

  // Helper to format house colors
  const getHouseColor = (houseId: string | null | undefined) => {
    switch (houseId?.toLowerCase()) {
      case "red": return "var(--red-house, #ef4444)";
      case "blue": return "var(--yellow-house, #3b82f6)";
      case "green": return "var(--blue-house, #22c55e)";
      case "yellow": return "var(--green-house, #94a3b8)"; // Green house in schema is named White/Pewter but colored green, etc.
      default: return "var(--text-secondary)";
    }
  };

  const getHouseName = (houseId: string | null | undefined) => {
    switch (houseId?.toLowerCase()) {
      case "red": return "Mom (มอม)";
      case "blue": return "Luang (ลวง)";
      case "green": return "Makara (มกร)";
      case "yellow": return "To (โต)";
      default: return "No House";
    }
  };

  return (
    <>
      <StudentNav />
      
      <main className="battle-hub-container" style={{ padding: "80px max(16px, env(safe-area-inset-right)) 80px max(16px, env(safe-area-inset-left))", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        {/* Banner Header */}
        <div className="hero-banner" style={{ background: "radial-gradient(ellipse at top, var(--accent-glow) 0%, rgba(252, 252, 253, 0) 70%)", borderRadius: "var(--radius-xl)", padding: "40px 24px", textAlign: "center", marginBottom: 32, border: "1px solid var(--border-subtle)", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--accent-glow)", color: "var(--accent-primary)", marginBottom: 16 }}>
            <Swords size={36} className="pulse" />
          </div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 900, marginBottom: 8, letterSpacing: "-0.04em" }}>
            P2P Battle Arena
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", maxWidth: 600, margin: "0 auto" }}>
            ท้าทายเพื่อนนักศึกษา CAMT ในเกม OX (Tic-Tac-Toe) แบบเรียลไทม์ผ่านการเชื่อมต่อแบบ Peer-to-Peer โดยตรง
          </p>

          {error && (
            <div style={{ maxWidth: 500, margin: "24px auto 0", background: "#fef2f2", border: "1px solid #fee2e2", padding: "12px 16px", borderRadius: "var(--radius-md)", color: "#991b1b", display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: 14 }}>{error}</span>
            </div>
          )}
        </div>

        {/* Create/Join CTA Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 40 }}>
          {/* Create Card */}
          <div className="glass" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", transition: "transform 0.2s" }}>
            <div style={{ width: 64, height: 64, borderRadius: "var(--radius-lg)", background: "var(--accent-glow)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)", marginBottom: 20 }}>
              <Play size={32} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 10 }}>สร้างห้องประลอง</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: 24, flexGrow: 1 }}>
              สร้างห้องใหม่เพื่อแชร์รหัส 4 หลัก หรือใช้ QR Code ให้เพื่อนของคุณสแกนเข้ามาประลองทันที
            </p>
            <button 
              className="btn" 
              style={{ background: "var(--accent-primary)", color: "#fff", width: "100%", height: 48 }}
              onClick={handleCreateRoom}
              disabled={creating}
            >
              {creating ? "กำลังสร้างห้อง..." : "สร้างห้องใหม่"}
            </button>
          </div>

          {/* Join Card */}
          <div className="glass" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", transition: "transform 0.2s" }}>
            <div style={{ width: 64, height: 64, borderRadius: "var(--radius-lg)", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", marginBottom: 20 }}>
              <Users size={32} />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 10 }}>เข้าร่วมเกม</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: 24, flexGrow: 1 }}>
              สแกน QR Code หรือป้อนรหัสห้อง 4 หลักที่เพื่อนของคุณสร้างไว้เพื่อเข้าเล่นร่วมกัน
            </p>
            <Link 
              href="/battle/join" 
              className="btn" 
              style={{ border: "2px solid #3b82f6", color: "#3b82f6", background: "transparent", width: "100%", height: 48, boxSizing: "border-box" }}
            >
              กรอกรหัสเข้าร่วม
            </Link>
          </div>
        </div>

        {/* Player Stats Dashboard */}
        {stats && (
          <div className="glass" style={{ padding: 24, marginBottom: 40, border: "1px solid var(--border-medium)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Medal size={20} color="var(--accent-primary)" /> สถิติการประลองของคุณ
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16 }}>
              {/* Win Card */}
              <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.1)", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>ชนะ (Wins)</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: "#22c55e", marginTop: 4 }}>{stats.wins}</p>
              </div>

              {/* Loss Card */}
              <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.1)", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>แพ้ (Losses)</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: "#ef4444", marginTop: 4 }}>{stats.losses}</p>
              </div>

              {/* Draw Card */}
              <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "rgba(107, 114, 128, 0.05)", border: "1px solid rgba(107, 114, 128, 0.1)", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>เสมอ (Draws)</p>
                <p style={{ fontSize: 32, fontWeight: 900, color: "var(--text-secondary)", marginTop: 4 }}>{stats.draws}</p>
              </div>

              {/* Win Streak Card */}
              <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--accent-glow)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Zap size={14} color="var(--accent-primary)" /> ชนะต่อเนื่อง
                </p>
                <p style={{ fontSize: 32, fontWeight: 900, color: "var(--accent-primary)", marginTop: 4 }}>{stats.winStreak}</p>
              </div>

              {/* Best Streak Card */}
              <div style={{ padding: 16, borderRadius: "var(--radius-md)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>สถิติต่อเนื่องสูงสุด</p>
                <p style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>{stats.bestStreak}</p>
              </div>
            </div>
          </div>
        )}

        {/* Never-played state (stats is null until the first finished game — US-FIX-20i AC-5) */}
        {!loading && !stats && (
          <div className="glass" style={{ padding: 24, marginBottom: 40, border: "1px dashed var(--border-medium)", textAlign: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Medal size={18} color="var(--text-muted)" /> ยังไม่มีสถิติการประลอง
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              คุณยังไม่เคยเล่นเกมจนจบเลย — สร้างห้องหรือเข้าร่วมเกมแรกเพื่อเริ่มเก็บสถิติ!
            </p>
          </div>
        )}

        {/* Tabs for Leaderboard & Match History */}
        <div style={{ marginBottom: 24, display: "flex", borderBottom: "1px solid var(--border-medium)" }}>
          <button 
            onClick={() => setActiveTab("leaderboard")}
            style={{ 
              padding: "12px 24px", 
              fontWeight: 600, 
              fontSize: 15,
              background: "transparent", 
              border: "none", 
              cursor: "pointer", 
              borderBottom: activeTab === "leaderboard" ? "3px solid var(--accent-primary)" : "none",
              color: activeTab === "leaderboard" ? "var(--text-primary)" : "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s"
            }}
          >
            <Trophy size={18} />
            กระดานผู้นำ OX (Leaderboard)
          </button>
          <button 
            onClick={() => setActiveTab("history")}
            style={{ 
              padding: "12px 24px", 
              fontWeight: 600, 
              fontSize: 15,
              background: "transparent", 
              border: "none", 
              cursor: "pointer", 
              borderBottom: activeTab === "history" ? "3px solid var(--accent-primary)" : "none",
              color: activeTab === "history" ? "var(--text-primary)" : "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.15s"
            }}
          >
            <History size={18} />
            ประวัติการแข่งของฉัน (History)
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <div className="spinner" style={{ margin: "0 auto 16px" }}></div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>กำลังดึงข้อมูลจากอารีน่า...</p>
          </div>
        ) : (
          <div>
            {activeTab === "leaderboard" && (
              <div className="glass" style={{ overflow: "hidden", padding: 0 }}>
                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-secondary)" }}>
                    ยังไม่เริ่มฤดูกาลแข่งขัน หรือไม่มีผู้ใช้บันทึกในขณะนี้
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>อันดับ (Rank)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>ผู้ประลอง (Player)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>บ้าน (House)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>จำนวนครั้งที่ชนะ (Wins)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>ชนะติดต่อกัน (Streak)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>สูงสุด (Best)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((item, index) => {
                          const medalColors = ["#ffd700", "#c0c0c0", "#cd7f32"];
                          const isTop3 = index < 3;
                          return (
                            <tr key={item.id} style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.15s" }} className="table-row-hover">
                              <td style={{ padding: "16px 24px", fontWeight: 700 }}>
                                {isTop3 ? (
                                  <span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: "50%", background: medalColors[index], color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                                    {index + 1}
                                  </span>
                                ) : (
                                  index + 1
                                )}
                              </td>
                              <td style={{ padding: "16px 24px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${getHouseColor(item.user.houseId)}` }}>
                                    {item.user.image ? (
                                      <img src={item.user.image} alt={item.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    ) : (
                                      <Users size={16} color="var(--text-secondary)" />
                                    )}
                                  </div>
                                  <div>
                                    <p style={{ fontWeight: 600, fontSize: 14 }}>{item.user.nickname || item.user.name}</p>
                                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{item.user.name}</p>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: "16px 24px" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: getHouseColor(item.user.houseId) }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: getHouseColor(item.user.houseId) }}></span>
                                  {getHouseName(item.user.houseId)}
                                </span>
                              </td>
                              <td style={{ padding: "16px 24px", fontWeight: 700, fontSize: 16, textAlign: "center", color: "#22c55e" }}>
                                {item.wins}
                              </td>
                              <td style={{ padding: "16px 24px", fontWeight: 600, textAlign: "center", color: "var(--accent-primary)" }}>
                                {item.winStreak > 0 ? `🔥 ${item.winStreak}` : "0"}
                              </td>
                              <td style={{ padding: "16px 24px", fontWeight: 500, textAlign: "center" }}>
                                {item.bestStreak}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="glass" style={{ overflow: "hidden", padding: 0 }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-secondary)" }}>
                    คุณยังไม่ได้เล่นแมตช์ใดเสร็จสิ้นเลย ประเดิมเกมแรกสิ!
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>ห้อง (Room)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>คู่แข่ง (Opponent)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textAlign: "center" }}>ผลลัพธ์ (Result)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>วิธีสิ้นสุด (End Reason)</th>
                          <th style={{ padding: "16px 24px", fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textAlign: "right" }}>วันที่เล่น (Date)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((roomItem) => {
                          const isHost = roomItem.hostId === user?.id;
                          const opponent = isHost ? roomItem.guest : roomItem.host;
                          
                          let resultText = "Draw";
                          let resultColor = "var(--text-secondary)";
                          let resultBg = "rgba(107, 114, 128, 0.05)";

                          if (roomItem.winnerId) {
                            if (roomItem.winnerId === user?.id) {
                              resultText = "Won";
                              resultColor = "#22c55e";
                              resultBg = "rgba(34, 197, 94, 0.05)";
                            } else {
                              resultText = "Lost";
                              resultColor = "#ef4444";
                              resultBg = "rgba(239, 68, 68, 0.05)";
                            }
                          }

                          const formattedDate = new Date(roomItem.updatedAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <tr key={roomItem.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "16px 24px", fontWeight: 700, color: "var(--text-secondary)" }}>
                                {roomItem.roomCode}
                              </td>
                              <td style={{ padding: "16px 24px" }}>
                                {opponent ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: getHouseColor(opponent.houseId) }}></span>
                                    <div>
                                      <p style={{ fontWeight: 600, fontSize: 14 }}>{opponent.nickname || opponent.name}</p>
                                      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{getHouseName(opponent.houseId)}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Unknown Opponent</span>
                                )}
                              </td>
                              <td style={{ padding: "16px 24px", textAlign: "center" }}>
                                <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 700, color: resultColor, background: resultBg }}>
                                  {resultText}
                                </span>
                              </td>
                              <td style={{ padding: "16px 24px", textTransform: "capitalize", fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                                {roomItem.finishReason || "completed"}
                              </td>
                              <td style={{ padding: "16px 24px", textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
                                {formattedDate}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
