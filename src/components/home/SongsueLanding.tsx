"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { signIn } from "next-auth/react";
import { Aperture, AlertTriangle, ChevronDown, Film, Lock } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { songsueCopy, type SongsueCopy } from "./songsue-copy";

// Registration opens 24 July 2026, 00:00 Bangkok time.
const REGISTRATION_OPENS_AT = new Date("2026-07-24T00:00:00+07:00").getTime();

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

// remainingMs starts null so server and client render the same locked
// placeholder; the real countdown is filled in after mount, avoiding a
// hydration mismatch from Date.now() differing between server and client.
function useCountdown(targetMs: number) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setRemainingMs(targetMs - Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetMs]);

  const isOpen = remainingMs !== null && remainingMs <= 0;
  const clamped = Math.max(0, remainingMs ?? targetMs);
  const days = Math.floor(clamped / (1000 * 60 * 60 * 24));
  const hours = Math.floor((clamped / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((clamped / (1000 * 60)) % 60);
  const seconds = Math.floor((clamped / 1000) % 60);

  return { isOpen, days, hours, minutes, seconds };
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" opacity="0.8" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" opacity="0.6" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

function BackgroundGlow() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div
        className="absolute pointer-events-none"
        style={{
          inset: 0,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 20%, black 0%, transparent 75%)",
        }}
      />
      <div
        className="absolute animate-pulse pointer-events-none"
        style={{
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,107,0,0.16) 0%, transparent 70%)",
          top: "-20%",
          right: "-10%",
          animationDuration: "9s",
        }}
      />
      <div
        className="absolute animate-pulse pointer-events-none"
        style={{
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,184,0,0.08) 0%, transparent 70%)",
          bottom: "-10%",
          left: "-10%",
          animationDuration: "13s",
          animationDelay: "2s",
        }}
      />
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 56 }}>
      <span style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: "rgba(255,255,255,0.95)", lineHeight: 1 }}>
        {String(value).padStart(2, "0")}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
        {label}
      </span>
    </div>
  );
}

// Placeholder art standing in for real event photography/footage — swap for a
// still + motion still of the actual event once assets exist. The diagonal
// split (grain vs. motion streaks) visualizes "two media" without needing a
// real asset yet.
function TwoMediaMockup() {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "min(88vw, 620px)",
        aspectRatio: "16 / 10",
        borderRadius: 24,
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 60px 140px -30px rgba(255,107,0,0.25), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 48%, #0a0a0a 52%, #1f1108 100%)",
        }}
      />
      {/* left half — "still" texture */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: "polygon(0 0, 52% 0, 48% 100%, 0 100%)",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.4px)",
          backgroundSize: "14px 14px",
          opacity: 0.7,
        }}
      />
      {/* right half — "motion" streaks */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: "polygon(52% 0, 100% 0, 100% 100%, 48% 100%)",
          backgroundImage:
            "repeating-linear-gradient(100deg, rgba(255,107,0,0.22) 0px, rgba(255,107,0,0.22) 2px, transparent 2px, transparent 18px)",
        }}
      />
      <div
        className="absolute"
        style={{ left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.15)" }}
      />
      <div className="absolute inset-0 flex items-center justify-center gap-10">
        <Aperture size={34} color="rgba(255,255,255,0.75)" strokeWidth={1.5} />
        <Film size={34} color="var(--accent-primary)" strokeWidth={1.5} />
      </div>
      <div
        className="absolute bottom-4 left-0 right-0 flex items-center justify-center"
        style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}
      >
        สองสื่อ · Songsue
      </div>
    </div>
  );
}

const wordContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.028 } },
};

const wordItem: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

function StaggerText({
  text,
  as = "p",
  className,
  style,
}: {
  text: string;
  as?: "p" | "h2";
  className?: string;
  style?: CSSProperties;
}) {
  const prefersReducedMotion = useReducedMotion();
  const words = text.split(" ");
  const Tag = motion[as];

  if (prefersReducedMotion) {
    const Plain = as;
    return (
      <Plain className={className} style={style}>
        {text}
      </Plain>
    );
  }

  return (
    <Tag
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.5 }}
      variants={wordContainer}
    >
      {words.map((word, i) => (
        <motion.span key={i} variants={wordItem} style={{ display: "inline-block" }}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Tag>
  );
}

function StickyMockupReveal({ section }: { section: SongsueCopy["sections"][number] }) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const mockupScale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.8, 1, 1, 1.08]);
  const mockupOpacity = useTransform(scrollYProgress, [0, 0.16], [0, 1]);
  const mockupBlurPx = useTransform(scrollYProgress, [0, 0.16], [14, 0]);
  const mockupFilter = useMotionTemplate`blur(${mockupBlurPx}px)`;
  const textOpacity = useTransform(scrollYProgress, [0.14, 0.3, 0.78, 0.96], [0, 1, 1, 0]);
  const textY = useTransform(scrollYProgress, [0.14, 0.3], [26, 0]);

  if (prefersReducedMotion) {
    return (
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-24 gap-10">
        <div className="max-w-xl flex flex-col gap-4">
          <span style={kickerStyle}>{section.kicker}</span>
          <h2 className="landing-title" style={sectionTitleStyle}>{section.title}</h2>
          <p style={sectionBodyStyle}>{section.body}</p>
        </div>
        <TwoMediaMockup />
      </section>
    );
  }

  return (
    <section ref={ref} className="relative" style={{ height: "240vh" }}>
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        <motion.div
          style={{ opacity: textOpacity, y: textY }}
          className="flex flex-col items-center gap-4 text-center max-w-xl mb-10"
        >
          <span style={kickerStyle}>{section.kicker}</span>
          <h2 className="landing-title" style={sectionTitleStyle}>{section.title}</h2>
        </motion.div>

        <motion.div style={{ scale: mockupScale, opacity: mockupOpacity, filter: mockupFilter }}>
          <TwoMediaMockup />
        </motion.div>

        <motion.p style={{ opacity: textOpacity }} className="mt-10 max-w-lg text-center" >
          <span style={sectionBodyStyle}>{section.body}</span>
        </motion.p>
      </div>
    </section>
  );
}

const kickerStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--accent-primary)",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "clamp(32px, 6vw, 56px)",
  fontWeight: 900,
  color: "rgba(255,255,255,0.96)",
  letterSpacing: "-0.02em",
};

const sectionBodyStyle: CSSProperties = {
  fontSize: "clamp(16px, 2vw, 20px)",
  color: "rgba(255,255,255,0.62)",
  lineHeight: 1.75,
};

export function SongsueLanding({
  variant = "home",
  authError = null,
}: {
  /** "login" always shows a working sign-in button (no registration countdown gate)
   *  and swaps the CTA copy for a returning-user welcome, since this variant is the
   *  auth entry/error-recovery surface, not the pre-launch registration pitch. */
  variant?: "home" | "login";
  authError?: string | null;
} = {}) {
  const { lang, setLang, t } = useLanguage();
  const storyLang: "th" | "en" = lang === "th" ? "th" : "en";
  const copy = songsueCopy[storyLang];
  const prefersReducedMotion = useReducedMotion();
  const countdown = useCountdown(REGISTRATION_OPENS_AT);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -80]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, prefersReducedMotion ? 1 : 0.92]);

  const reveal = prefersReducedMotion
    ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true, amount: 0.4 }, transition: { duration: 0.5 } }
    : { initial: { opacity: 0, y: 40 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.4 }, transition: { duration: 0.7, ease: EASE_OUT } };

  const [middleSection, joinSection] = [copy.sections[1], copy.sections[2]];

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "#030303" }}>
      <BackgroundGlow />

      {/* Language toggle — no navbar, just a minimal floating control */}
      <button
        onClick={() => setLang(storyLang === "th" ? "en" : "th")}
        className="fixed z-50 touch-target"
        style={{
          top: "max(20px, env(safe-area-inset-top))",
          right: "max(20px, env(safe-area-inset-right))",
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          fontSize: 13,
          fontWeight: 800,
          color: "rgba(255,255,255,0.9)",
          cursor: "pointer",
        }}
        aria-label="Toggle language"
      >
        {copy.langToggleLabel}
      </button>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div ref={heroRef} className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "100vh" }}>
        <motion.div
          style={prefersReducedMotion ? undefined : { opacity: heroOpacity, y: heroY, scale: heroScale }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
          className="flex flex-col items-center gap-6 max-w-3xl"
        >
          <span style={kickerStyle}>{copy.hero.kicker}</span>
          <h1
            className="landing-title"
            style={{
              fontSize: "clamp(56px, 14vw, 140px)",
              fontWeight: 950,
              color: "rgba(255,255,255,0.97)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
            }}
          >
            <span className="gradient-text">{copy.hero.titleTh}</span>
          </h1>
          <p style={{ fontSize: "clamp(14px, 2vw, 18px)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
            {copy.hero.titleEn}
          </p>
          <p style={{ fontSize: "clamp(16px, 2.2vw, 24px)", color: "rgba(255,255,255,0.68)", lineHeight: 1.6, maxWidth: 560 }}>
            {copy.hero.tagline}
          </p>
        </motion.div>

        <motion.div
          className="absolute bottom-10 flex flex-col items-center gap-2"
          animate={prefersReducedMotion ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{copy.hero.scrollHint}</span>
          <ChevronDown size={20} color="rgba(255,255,255,0.4)" />
        </motion.div>
      </div>

      {/* ── §1 — pinned scroll reveal with placeholder two-media mockup ───── */}
      <StickyMockupReveal section={copy.sections[0]} />

      {/* ── §2 / §3 — staggered text reveal ─────────────────────────────── */}
      {[middleSection, joinSection].map((section, i) => (
        <motion.section
          key={i}
          {...reveal}
          className="relative flex flex-col items-center justify-center text-center px-6"
          style={{ minHeight: "80vh" }}
        >
          <div className="max-w-2xl flex flex-col gap-5">
            <span style={kickerStyle}>{section.kicker}</span>
            <StaggerText as="h2" text={section.title} className="landing-title" style={sectionTitleStyle} />
            <StaggerText text={section.body} style={sectionBodyStyle} />
          </div>
        </motion.section>
      ))}

      {/* ── CTA / Register ───────────────────────────────────────────────── */}
      <motion.section
        {...reveal}
        className="relative flex flex-col items-center justify-center text-center px-6 py-24"
        style={{ minHeight: "90vh" }}
      >
        <div
          className="flex flex-col items-center gap-8 w-full"
          style={{
            maxWidth: 560,
            padding: "clamp(32px, 6vw, 56px)",
            borderRadius: 28,
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 60px 160px -30px rgba(0,0,0,0.6)",
          }}
        >
          <div className="flex flex-col gap-3">
            <span style={kickerStyle}>{variant === "login" ? copy.hero.kicker : copy.cta.kicker}</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 40px)", fontWeight: 900, color: "rgba(255,255,255,0.96)", letterSpacing: "-0.02em" }}>
              {variant === "login" ? t.welcome : copy.cta.title}
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
              {variant === "login" ? t.accessDashboard : copy.cta.body}
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="flex flex-col gap-2 w-full text-left"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.35)",
                borderRadius: 16,
                padding: "16px 18px",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} style={{ flexShrink: 0, color: "#f87171" }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "#f87171" }}>{t.signInErrorTitle}</span>
              </div>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.55, margin: 0 }}>{t.signInErrorBody}</p>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.55, margin: 0 }}>{t.signInErrorHint}</p>
            </div>
          )}

          {variant === "login" || countdown.isOpen ? (
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="btn btn-primary btn-full touch-target"
              style={{
                height: "clamp(60px, 7vw, 72px)",
                borderRadius: "clamp(18px, 2vw, 22px)",
                fontSize: "clamp(16px, 2vw, 18px)",
                boxShadow: "0 28px 56px var(--accent-glow)",
                gap: 14,
              }}
            >
              <GoogleIcon />
              {variant === "login" ? t.signInBtn : copy.cta.unlockedLabel}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.45)" }}>
                <Lock size={14} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{copy.cta.lockedLabel}</span>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <CountdownUnit value={countdown.days} label={storyLang === "th" ? "วัน" : "days"} />
                <CountdownUnit value={countdown.hours} label={storyLang === "th" ? "ชม." : "hrs"} />
                <CountdownUnit value={countdown.minutes} label={storyLang === "th" ? "นาที" : "min"} />
                <CountdownUnit value={countdown.seconds} label={storyLang === "th" ? "วินาที" : "sec"} />
              </div>
              <button
                disabled
                className="btn btn-primary btn-full touch-target"
                style={{
                  height: "clamp(56px, 6.5vw, 64px)",
                  borderRadius: "clamp(16px, 2vw, 20px)",
                  fontSize: "clamp(15px, 1.8vw, 17px)",
                  gap: 12,
                }}
              >
                <Lock size={18} />
                {copy.cta.dateNote}
              </button>
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
