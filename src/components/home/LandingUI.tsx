
"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { ArrowRight, ShieldCheck, Zap, UserCheck, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { signIn } from "next-auth/react";

export function LandingUI({ 
  userCount = 0, 
  sampleImages = [] 
}: { 
  userCount?: number; 
  sampleImages?: string[];
}) {
  const { t } = useLanguage();

  const displayCount = userCount > 500 ? `${userCount}+` : userCount;
  const joinText = userCount === 1 ? t.studentSingle : t.studentPlural;

  return (
    <div
      className="min-h-screen relative flex flex-col overflow-y-auto lg:overflow-hidden"
      style={{ background: "#f8fafc" }}
    >
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute opacity-[0.03]"
          style={{
            inset: 0,
            backgroundImage: `radial-gradient(var(--accent-primary) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        {/* Animated Orbs */}
        <div
          className="absolute animate-pulse"
          style={{
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,107,0,0.06) 0%, transparent 70%)",
            top: "-10%",
            right: "-5%",
            animationDuration: '8s'
          }}
        />
        <div
          className="absolute animate-pulse"
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,184,0,0.04) 0%, transparent 70%)",
            bottom: "-10%",
            left: "-5%",
            animationDuration: '12s',
            animationDelay: '2s'
          }}
        />
      </div>

      <main className="relative z-10 w-full mx-auto px-6 lg:px-12 py-12 lg:py-0 flex-1 flex flex-col lg:flex-row gap-12 lg:gap-24 items-center justify-center">
        
        {/* Left: Branding & Value Prop */}
        <div className="flex flex-col gap-6 lg:gap-12 animate-fade-in-up text-center lg:text-left items-center lg:items-start w-full lg:w-auto max-w-[600px]">
          <div className="flex items-center gap-3">
            <div style={{ padding: "6px 20px", background: "var(--accent-glow)", borderRadius: 100, border: "1px solid rgba(255,107,0,0.15)" }}>
              <span style={{ fontSize: "clamp(11px, 1.5vw, 13px)", fontWeight: 800, color: "var(--accent-primary)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{t.studentPortal}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:gap-8">
            <h1 style={{ fontSize: "clamp(40px, 8vw, 84px)", fontWeight: 950, letterSpacing: "-0.05em", lineHeight: 0.85, color: "var(--text-primary)" }}>
              Experience <br />
              <span className="gradient-text">ActiveCAMT</span>
            </h1>
            <p style={{ fontSize: "clamp(16px, 1.8vw, 22px)", color: "var(--text-secondary)", lineHeight: 1.5, maxWidth: "520px" }}>
              {t.signInSub}
            </p>
          </div>

          <div className="hidden sm:flex flex-col sm:flex-row gap-6 lg:gap-12 mt-2 lg:mt-4">
            <div className="flex items-center gap-3 lg:gap-4 group">
              <div 
                style={{ borderRadius: 16, background: "white", boxShadow: "0 8px 20px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease" }} 
                className="w-11 h-11 lg:w-12 lg:h-12 group-hover:scale-110 group-hover:shadow-lg"
              >
                <Zap size={22} color="var(--accent-primary)" />
              </div>
              <p style={{ fontWeight: 600, color: "var(--text-primary)" }} className="text-base lg:text-[17px]">{t.instantCheckin}</p>
            </div>
            <div className="flex items-center gap-3 lg:gap-4 group">
              <div 
                style={{ borderRadius: 16, background: "white", boxShadow: "0 8px 20px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease" }} 
                className="w-11 h-11 lg:w-12 lg:h-12 group-hover:scale-110 group-hover:shadow-lg"
              >
                <Sparkles size={22} color="var(--accent-secondary)" />
              </div>
              <p style={{ fontWeight: 600, color: "var(--text-primary)" }} className="text-base lg:text-[17px]">{t.houseRewards}</p>
            </div>
          </div>
        </div>

        {/* Right: Auth Card */}
        <div className="flex justify-center animate-fade-in-up w-full lg:w-auto max-w-[500px]" style={{ animationDelay: '0.1s' }}>
          <div
            style={{
              background: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
              border: "1px solid white",
              borderRadius: "clamp(32px, 5vw, 48px)",
              padding: "clamp(32px, 6vw, 64px)",
              width: "100%",
              boxShadow: "0 50px 140px -20px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "clamp(32px, 5vw, 48px)",
              position: "relative"
            }}
          >
            <div className="flex flex-col gap-3 lg:gap-4">
              <h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 850, color: "var(--text-primary)", letterSpacing: "-0.04em", lineHeight: 1.1 }}>{t.welcome}</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "clamp(16px, 1.5vw, 18px)", fontWeight: 500 }}>{t.accessDashboard}</p>
            </div>

            <div className="flex flex-col gap-5 lg:gap-6">
              <button
                onClick={() => signIn("google")}
                className="btn btn-primary btn-full"
                style={{ 
                  height: "clamp(64px, 8vw, 76px)", 
                  borderRadius: "clamp(18px, 2vw, 24px)", 
                  fontSize: "clamp(18px, 2vw, 20px)", 
                  boxShadow: "0 28px 56px var(--accent-glow)",
                  gap: 16
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity="0.8" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity="0.6" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity="0.9" />
                </svg>
                {t.signInBtn}
              </button>

              <div className="flex items-center gap-3 justify-center group cursor-default">
                <ShieldCheck size={20} className="text-gray-400 group-hover:text-green-500 transition-colors" />
                <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>{t.verified}</p>
              </div>
            </div>

            <div className="mt-2 pt-8 lg:pt-12 border-t border-black/[0.04] flex flex-col gap-6 lg:gap-8">
              <div className="flex items-center gap-4 justify-center lg:justify-start">
                <div className="flex -space-x-3">
                  {sampleImages.length > 0 ? (
                    sampleImages.map((img, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          width: 36, 
                          height: 36, 
                          borderRadius: "50%", 
                          background: "var(--bg-elevated)", 
                          border: "3px solid white", 
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        <img 
                          src={img} 
                          alt="Student" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-center;background:var(--bg-elevated);color:var(--text-muted);font-size:10px;font-weight:900">?</div>';
                          }}
                        />
                      </div>
                    ))
                  ) : (
                    [1,2,3,4].map(i => (
                      <div key={i} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-elevated)", border: "3px solid white", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} />
                    ))
                  )}
                </div>
                <p style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 600 }}>
                  Join {displayCount} active {joinText}
                </p>
              </div>

              {/* Language Switcher in the Card */}
              <div className="pt-1 flex justify-center lg:justify-start">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - Absolute on desktop, relative on mobile */}
      <footer className="w-full px-8 py-10 lg:py-6 lg:absolute lg:bottom-0 flex flex-col lg:flex-row items-center justify-center lg:justify-start gap-4 lg:gap-8 border-t border-black/[0.03] bg-white/30 backdrop-blur-md z-20">
        <p style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "0.02em" }}>© SMO CAMT 2026</p>
        <div className="hidden lg:block" style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-muted)" }} />
        <p style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500, textAlign: "center" }}>{t.modernizing}</p>
      </footer>
    </div>
  );
}
