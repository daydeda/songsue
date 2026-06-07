
"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { 
  LogOut, 
  MapPin, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Zap, 
  User, 
  RefreshCw,
  Trophy,
  ArrowRight,
  Settings,
  X,
  AlertCircle
} from "lucide-react";
import { parseRichText } from "@/lib/rich-text";
import { useLanguage } from "@/lib/LanguageContext";
import { StudentNav } from "@/components/layout/StudentNav";

type Event = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  quota?: number;
  isRegistered?: boolean;
  attendanceStatus?: string | null;
  imageUrl?: string;
  pointsAwarded?: number;
};

interface HouseItem {
  id: string;
  name: string;
  color: string;
  points: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { t, lang } = useLanguage();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({
    show: false,
    title: "",
    message: "",
  });
  const [houses, setHouses] = useState<HouseItem[]>([]);
  const [loadingHouses, setLoadingHouses] = useState(true);
  
  const HOUSE_MAP: Record<string, { name: string, color: string }> = {
    red:    { name: "Lanna",   color: "#ef4444" },
    green:  { name: "Mengrai", color: "#14b8a6" },
    yellow: { name: "Kawila",  color: "#f59e0b" },
    blue:   { name: "Dara",    color: "#6366f1" },
  };

  const fetchEvents = () => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setEvents(d); })
      .finally(() => setLoadingEvents(false));
  };

  const fetchHouses = () => {
    fetch("/api/houses")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setHouses(d); })
      .finally(() => setLoadingHouses(false));
  };

  useEffect(() => {
    fetchEvents();
    fetchHouses();

    // Establish Server-Sent Events (SSE) Real-time subscription for students
    const eventSource = new EventSource("/api/realtime");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "ping") return;

        if (
          payload.type === "event_created" ||
          payload.type === "event_updated" ||
          payload.type === "event_deleted"
        ) {
          fetchEvents(); // Live update the events listing on student dashboard!
        } else if (payload.type === "score") {
          fetchHouses(); // Live update the scoreboard/leaderboard on student dashboard!
        }
      } catch (err) {
        console.error("SSE parse error in student dashboard:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleRegister = async (eventId: string, registered: boolean) => {
    setRegisteringId(eventId);
    const method = registered ? "DELETE" : "POST";
    const res = await fetch(`/api/events/${eventId}/register`, { method });
    if (res.ok) {
      setEvents((evts) =>
        evts.map((e) => (e.id === eventId ? { ...e, isRegistered: !registered } : e))
      );
    } else {
      const errorData = await res.json();
      const errorMsg = errorData.error || t.registrationFailed;
      setErrorModal({
        show: true,
        title: t.registrationFailed,
        message: errorMsg
      });
    }
    setRegisteringId(null);
  };

  if (status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const user = session?.user;
  const houseId = user?.houseId ?? null;
  const houseInfo = houseId ? (HOUSE_MAP[houseId] ?? { name: "Unknown", color: "var(--text-muted)" }) : { name: t.unassigned, color: "var(--text-muted)" };
  const qrValue = user?.qrToken ?? user?.id ?? "no-token";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Events that are either happening today or in the future
  const upcoming = events.filter((e) => new Date(e.endTime) >= startOfToday);
  const past = events.filter((e) => new Date(e.endTime) < startOfToday);

  const getEventStatus = (evt: Event) => {
    const dNow = new Date();
    const start = new Date(evt.startTime);
    const end = new Date(evt.endTime);
    
    // If start and end are same, it's a "point" event, don't show as LIVE
    if (start.getTime() === end.getTime()) {
      return dNow > end ? "past" : "upcoming";
    }

    if (dNow >= start && dNow <= end) return "live";
    if (dNow > end) return "past";
    return "upcoming";
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      {/* Decorative Orbs */}
      <div className="absolute top-[-200px] left-[-100px] w-[600px] h-[600px] rounded-full" 
           style={{ background: "radial-gradient(circle, rgba(255,107,0,0.03) 0%, transparent 70%)", pointerEvents: "none" }} />
      
      <StudentNav />

      <main className="page-container" style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 40 }}>
        
        {/* Header Section */}
        <section className="animate-fade-in-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 24 }}>
          <div>
            <h1 className="text-fluid-h1" style={{ fontWeight: 900, letterSpacing: "-0.04em" }}>
              {t.hey}, <span className="gradient-text">{user?.name?.split(" ")[0] || "Student"}!</span>
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
              <p style={{ color: "var(--text-secondary)", fontSize: 17, fontWeight: 500 }}>
                {t.upcomingEventsCount.replace("{count}", upcoming.length.toString())}
              </p>
            </div>
          </div>

          {/* House Stats Card */}
          <div
            className="glass"
            style={{
              padding: "20px 32px",
              textAlign: "center",
              minWidth: 160,
              boxShadow: `0 10px 30px rgba(0,0,0,0.04), 0 0 0 1px ${houseInfo.color}20`,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              background: "rgba(255,255,255,0.6)"
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: houseInfo.color, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Trophy size={12} />
              {houseInfo.name} {t.house}
            </p>
            <p style={{ fontSize: 32, fontWeight: 900, color: houseInfo.color, filter: "brightness(0.8)" }}>
              {houseInfo.name.toUpperCase()}
            </p>
          </div>
        </section>

        {/* Dynamic Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
          
          {/* Left Column: Events */}
          <div className="order-2 lg:order-1" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            
            {/* Featured Event / Alert */}
            <div className="alert alert-info" style={{ borderRadius: "var(--radius-lg)", padding: 20, background: "rgba(255,107,0,0.04)", border: "1px solid rgba(255,107,0,0.1)" }}>
              <div style={{ fontSize: 24, background: "var(--bg-surface)", padding: 8, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>🚀</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>New Semester Kick-off!</p>
                <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Don&apos;t forget to register for the Freshy night and check your house points.</p>
              </div>
            </div>

            <div style={{ marginBottom: 40 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>{t.upcomingEvents}</h2>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => {
                    setLoadingEvents(true);
                    fetch("/api/events")
                      .then(r => r.json())
                      .then(d => { if (Array.isArray(d)) setEvents(d); })
                      .finally(() => setLoadingEvents(false));
                  }}
                  style={{ gap: 6 }}
                >
                   <RefreshCw size={14} />
                   {t.refresh}
                </button>
              </div>

              {loadingEvents ? (
                <div style={{ padding: 60, display: "flex", justifyContent: "center" }}>
                  <div className="spinner" style={{ width: 32, height: 32 }} />
                </div>
              ) : upcoming.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
                  {upcoming.map((e) => (
                    <div 
                      key={e.id} 
                      className="glass animate-fade-in-up event-card-ig"
                      style={{ 
                        height: "100%",
                        borderRadius: 32,
                        border: "1px solid var(--border-subtle)",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        cursor: "default",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        background: "var(--bg-surface)",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.03)"
                      }}
                    >
                      {/* Poster Area */}
                      <div style={{ position: "relative", aspectRatio: "1/1", background: "#1a1a1a", overflow: "hidden" }}>
                         {e.imageUrl ? (
                           <img 
                             src={e.imageUrl} 
                             alt={e.title} 
                             style={{ width: "100%", height: "100%", objectFit: "contain" }} 
                           />
                         ) : (
                           <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(45deg, var(--bg-elevated), var(--bg-surface))" }}>
                             <Calendar size={48} style={{ color: "var(--text-muted)", opacity: 0.2 }} />
                           </div>
                         )}
                         
                         {/* Date Overlay */}
                         <div style={{ position: "absolute", top: 16, right: 16 }}>
                            <div style={{ 
                               background: "#fff", 
                               padding: "10px 14px", 
                               borderRadius: 18, 
                               boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                               textAlign: "center", 
                               minWidth: 64,
                               border: "1px solid rgba(0,0,0,0.05)"
                            }}>
                               <p style={{ fontSize: 11, fontWeight: 900, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                                 {new Date(e.startTime).toLocaleDateString("en-GB", { month: "short", timeZone: "Asia/Bangkok" })}
                               </p>
                               <p style={{ fontSize: 22, fontWeight: 900, color: "#111", lineHeight: 1 }}>
                                 {new Date(e.startTime).toLocaleDateString("en-GB", { day: "numeric", timeZone: "Asia/Bangkok" })}
                               </p>
                            </div>
                         </div>

                         <div style={{ position: "absolute", top: 16, left: 16 }}>
                           <span style={{ 
                             padding: "8px 16px", 
                             background: getEventStatus(e) === 'live' ? "#ef4444" : "var(--accent-primary)", 
                             color: "#fff", 
                             borderRadius: 20, 
                             fontSize: 12, 
                             fontWeight: 900, 
                             textTransform: "uppercase", 
                             letterSpacing: "0.05em",
                             boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                           }}>
                             {getEventStatus(e)}
                           </span>
                         </div>

                         {/* Points Badge */}
                         {e.pointsAwarded !== undefined && (
                           <div style={{ position: "absolute", bottom: 16, left: 16 }}>
                             <div style={{ 
                               background: "rgba(0, 0, 0, 0.7)", 
                               backdropFilter: "blur(8px)", 
                               color: "#fff", 
                               padding: "6px 12px", 
                               borderRadius: 14, 
                               fontSize: 11, 
                               fontWeight: 900, 
                               display: "inline-flex", 
                               alignItems: "center", 
                               gap: 6, 
                               boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                               border: "1px solid rgba(255, 255, 255, 0.1)"
                             }}>
                               <Trophy size={12} style={{ color: "#fbbf24" }} />
                               <span>{e.pointsAwarded} PTS</span>
                             </div>
                           </div>
                         )}
                      </div>

                      {/* Content Area */}
                      <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column" }}>
                        <h3 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", marginBottom: 16 }}>{e.title}</h3>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text-secondary)", fontWeight: 600 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,107,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
                               <Clock size={16} />
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600, lineHeight: 1.4 }}>
                              {(() => {
                                const start = new Date(e.startTime);
                                const end = new Date(e.endTime);
                                const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' };
                                const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' };
                                
                                return `${start.toLocaleDateString('en-GB', dateOpts)} ${start.toLocaleTimeString('en-GB', timeOpts)} — ${end.toLocaleDateString('en-GB', dateOpts)} ${end.toLocaleTimeString('en-GB', timeOpts)}`;
                              })()}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--text-secondary)", fontWeight: 600 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,107,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)" }}>
                               <MapPin size={16} />
                            </div>
                            {e.location || "CAMT Building"}
                          </div>
                        </div>

                        <div 
                          style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                          dangerouslySetInnerHTML={{ __html: parseRichText(e.description || "") }}
                        />

                        <div style={{ marginTop: "auto", paddingTop: 8 }}>
                          {(() => {
                            const isPastEvent = new Date() > new Date(e.endTime);
                            const isAttended = e.attendanceStatus === "attended";
                            const canCancel = !isPastEvent && !isAttended;
                            const isDisabled = (e.isRegistered && !canCancel) || registeringId === e.id;

                            return (
                              <button
                                disabled={isDisabled}
                                onClick={() => handleRegister(e.id, !!e.isRegistered)}
                                className={`btn btn-full ${e.isRegistered ? "btn-success-solid" : "btn-primary"}`}
                                style={{ 
                                  borderRadius: 16, 
                                  height: 48, 
                                  fontWeight: 800,
                                  background: e.isRegistered ? (canCancel ? "#10b981" : "var(--bg-elevated)") : undefined,
                                  color: e.isRegistered ? (canCancel ? "#fff" : "var(--text-muted)") : undefined,
                                  boxShadow: (e.isRegistered && canCancel) ? "0 10px 25px rgba(16,185,129,0.3)" : (e.isRegistered ? "none" : "0 10px 25px var(--accent-glow)"),
                                  border: e.isRegistered && !canCancel ? "1px solid var(--border-subtle)" : "none",
                                  cursor: isDisabled && !registeringId ? "not-allowed" : "pointer",
                                  opacity: e.isRegistered && !canCancel ? 0.8 : 1
                                }}
                              >
                                {registeringId === e.id ? (
                                  <RefreshCw size={18} className="animate-spin" />
                                ) : e.isRegistered ? (
                                  isAttended ? (
                                    <><CheckCircle2 size={18} /> {t.attended || "Attended"}</>
                                  ) : isPastEvent ? (
                                    <><Calendar size={18} /> {t.eventEnded || "Event Ended"}</>
                                  ) : (
                                    <><CheckCircle2 size={18} /> {t.registered || "Registered"}</>
                                  )
                                ) : (
                                  t.registerNow || "Register Now"
                                )}
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "80px 40px", textAlign: "center", background: "var(--bg-surface)", borderRadius: 24, border: "2px dashed var(--border-subtle)" }}>
                   <p style={{ color: "var(--text-muted)", fontWeight: 500 }}>{t.noEvents}</p>
                </div>
              )}
            </div>
          </div>
          {/* Right Column: Sidebar Stats */}
            <div className="order-1 lg:order-2" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {/* Digital ID Card */}
              <div
                className="stat-card animate-fade-in-up"
                style={{ 
                  padding: "clamp(20px, 5vw, 32px)", 
                  background: "var(--bg-surface)",
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  gap: 24,
                  boxShadow: "0 20px 50px rgba(0,0,0,0.06)",
                  border: "1px solid var(--border-medium)",
                  width: "100%"
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    padding: "clamp(12px, 3vw, 24px)",
                    borderRadius: 28,
                    border: "1px solid var(--border-medium)",
                    boxShadow: "0 0 50px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                    width: "100%",
                    maxWidth: 300
                  }}
                >
                  {user?.image ? (
                    <div style={{ width: 80, height: 80, borderRadius: 16, overflow: "hidden", border: "1px solid var(--border-subtle)", position: "relative" }}>
                      <img 
                        src={user.image} 
                        alt="" 
                        style={{ 
                          position: "absolute",
                          width: "100%", 
                          height: "100%", 
                          objectFit: "cover",
                          transform: user.imageTransform ? `scale(${user.imageTransform.scale}) translate(${user.imageTransform.x}%, ${user.imageTransform.y}%)` : 'none'
                        }} 
                      />
                    </div>
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: 16, background: "var(--bg-elevated)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User size={32} color="var(--text-muted)" />
                    </div>
                  )}
                  <QRCodeSVG
                    value={qrValue}
                    size={240}
                    style={{ width: "100%", height: "auto", maxWidth: 240 }}
                    level="H"
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>

                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>{user?.name}</p>
                  <p style={{ fontSize: 16, color: "var(--text-muted)", marginTop: 6, fontWeight: 600 }}>ID: {user?.studentId || "212110XXX"}</p>
                </div>
              </div>

              {/* Leaderboard Sidebar */}
              <div className="glass" style={{ padding: 24, borderRadius: 24, background: "rgba(255,255,255,0.6)" }}>
                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                   <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                      <Trophy size={14} className="text-accent" />
                      {t.leaderboard}
                   </h3>
                   <span style={{ fontSize: 10, fontWeight: 900, background: "var(--bg-elevated)", padding: "4px 8px", borderRadius: 8, color: "var(--text-muted)" }}>LIVE</span>
                 </div>
                 
                 {loadingHouses ? (
                   <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
                     <div className="spinner" style={{ width: 24, height: 24 }} />
                   </div>
                 ) : (
                   <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {houses.map((h, idx) => {
                        const isUserHouse = h.id === houseId;
                        const maxPoints = Math.max(...houses.map(x => x.points || 0), 1);
                        const percentage = Math.min(100, ((h.points || 0) / maxPoints) * 100);
                        
                        return (
                          <div key={h.id} style={{ 
                            padding: "12px 16px", 
                            background: isUserHouse ? `${h.color}10` : "var(--bg-elevated)",
                            borderRadius: 16,
                            border: `1px solid ${isUserHouse ? `${h.color}30` : "transparent"}`,
                            position: "relative",
                            overflow: "hidden"
                          }}>
                            {isUserHouse && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: h.color }} />}
                            
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                 <span style={{ fontSize: 12, fontWeight: 900, color: idx === 0 ? "#fbbf24" : "var(--text-muted)", width: 14 }}>{idx + 1}</span>
                                 <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{h.name}</span>
                                 {isUserHouse && <span style={{ fontSize: 9, fontWeight: 900, background: h.color, color: "#fff", padding: "2px 6px", borderRadius: 6 }}>YOU</span>}
                              </div>
                              <span style={{ fontSize: 14, fontWeight: 900, color: h.color }}>{h.points || 0} <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>PTS</span></span>
                            </div>
                            
                            <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.05)", borderRadius: 99 }}>
                              <div style={{ 
                                width: `${percentage}%`, 
                                height: "100%", 
                                background: h.color, 
                                borderRadius: 99,
                                boxShadow: idx === 0 ? `0 0 10px ${h.color}40` : "none",
                                transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)"
                              }} />
                            </div>
                          </div>
                        );
                      })}
                   </div>
                 )}
                 
                 <Link href="/dashboard/houses" style={{ 
                   marginTop: 20, 
                   display: "flex", 
                   alignItems: "center", 
                   justifyContent: "center", 
                   gap: 8, 
                   fontSize: 12, 
                   fontWeight: 800, 
                   color: "var(--accent-primary)",
                   textDecoration: "none",
                   padding: "12px",
                   borderRadius: 16,
                   background: "rgba(255,107,0,0.05)"
                 }}>
                    {t.houseRankings}
                    <ArrowRight size={14} />
                 </Link>
              </div>
            </div>
          </div>
        </main>

      {errorModal.show && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          zIndex: 1350,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }} onClick={() => setErrorModal(prev => ({ ...prev, show: false }))}>
          <div className="animate-fade-in-up" style={{
            background: "var(--bg-surface)",
            width: "90%",
            maxWidth: 440,
            borderRadius: 28,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
            border: "1px solid var(--border-medium)"
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px"
            }}>
              <X size={28} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 900, color: "var(--text-primary)", marginBottom: 12 }}>
              {errorModal.title}
            </h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
              {errorModal.message}
            </p>
            <button
              className="btn btn-ghost"
              style={{ width: "100%", height: 46, borderRadius: 12, fontSize: 14, fontWeight: 800, border: "1px solid var(--border-medium)" }}
              onClick={() => setErrorModal(prev => ({ ...prev, show: false }))}
            >
              {lang === "th" ? "ปิด" : "Close"}
            </button>
          </div>
        </div>
      )}

        <style jsx global>{`
          .event-card-ig:hover {
            transform: translateY(-8px);
            box-shadow: 0 30px 60px rgba(0,0,0,0.08) !important;
            border-color: var(--accent-primary) !important;
          }
          .event-card-ig img {
            transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .event-card-ig:hover img {
            transform: scale(1.05);
          }
        `}</style>
      </div>
    );
}