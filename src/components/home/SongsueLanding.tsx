"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { signIn } from "next-auth/react";
import { AlertTriangle, ChevronDown, ImageOff, Lock } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { REGISTRATION_OPENS_AT } from "@/lib/registration-window";
import { songsueCopy, type SongsueCopy } from "./songsue-copy";
import { houses, type HouseInfo } from "./houses-data";

// three.js touches the DOM/WebGL — must never run during SSR.
const FlagFlutter3D = dynamic(
  () => import("./FlagFlutter3D").then((mod) => mod.FlagFlutter3D),
  { ssr: false }
);

const DoorCastle3D = dynamic(
  () => import("./DoorCastle3D").then((mod) => mod.DoorCastle3D),
  { ssr: false }
);

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
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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
          background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
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
          background: "radial-gradient(circle, rgba(156,163,175,0.06) 0%, transparent 70%)",
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

const kickerStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#9ca3af",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: "clamp(32px, 6vw, 56px)",
  fontWeight: 900,
  color: "rgba(255,255,255,0.96)",
  letterSpacing: "-0.02em",
};

// Section 2 — the animated 3D flag, one house at a time. This is the only
// place the flutter animation appears (moved here from the door-carousel
// below, which is now gated behind a click and shouldn't be where the
// headline motion lives) — so only ever one WebGL canvas is mounted.
function FlagsCarousel({
  houses,
  storyLang,
  prefersReducedMotion,
  copy,
}: {
  houses: HouseInfo[];
  storyLang: "th" | "en";
  prefersReducedMotion: boolean;
  copy: SongsueCopy;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextHouse = () => {
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % houses.length);
  };
  const prevHouse = () => {
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + houses.length) % houses.length);
  };
  const goToHouse = (idx: number) => {
    if (idx === activeIndex) return;
    setDirection(idx > activeIndex ? 1 : -1);
    setActiveIndex(idx);
  };

  const house = houses[activeIndex];

  return (
    <section className="relative isolate flex flex-col items-center justify-center px-6 py-14 lg:py-20 w-full overflow-hidden" style={{ minHeight: "100svh" }}>
      {/* Per-house looping background video, crossfaded on house change.
          Skipped entirely under prefers-reduced-motion — autoplaying video
          is exactly the kind of motion that setting asks us not to run. */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* initial={false}: the first house's video must be visible the
              instant it mounts, not wait on a client-side opacity transition
              — if that transition ever fails to fire (slow hydration, tab
              backgrounded, etc.) the section renders as solid black with no
              recovery. Later house switches still crossfade normally since
              this only suppresses the very first mount's enter animation. */}
          <AnimatePresence mode="sync" initial={false}>
            {house.bgVideoSrc && (
              <motion.video
                key={house.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute inset-0 w-full h-full object-cover"
                src={house.bgVideoSrc}
                autoPlay
                muted
                loop
                playsInline
              />
            )}
          </AnimatePresence>
          {/* Light darken/blend so caption text stays readable — the source
              footage (moonlit clouds, embers, dark stone) is already very
              dark on its own, so a heavy overlay here was making the video
              disappear entirely instead of just legible-izing text over it. */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(3,3,3,0.15) 0%, rgba(3,3,3,0.3) 60%, rgba(3,3,3,0.5) 100%)" }} />
        </div>
      )}

      <div className="max-w-xl flex flex-col items-center gap-3 text-center mb-6 lg:mb-12 z-10">
        <span style={kickerStyle}>{copy.flags.kicker}</span>
        <h2 className="landing-title" style={sectionTitleStyle}>
          {copy.flags.title}
        </h2>
      </div>

      <div className="relative w-full max-w-7xl mx-auto flex flex-col items-center min-h-[70svh] lg:min-h-[80svh]">
        <div className="w-full relative overflow-hidden flex items-center justify-center min-h-[70svh] lg:min-h-[80svh]">
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={activeIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction === 0 ? 0 : direction * 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -50 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              dragMomentum={false}
              onDragEnd={(e, { offset, velocity }) => {
                if (offset.x < -60 || velocity.x < -400) {
                  nextHouse();
                } else if (offset.x > 60 || velocity.x > 400) {
                  prevHouse();
                }
              }}
              className="w-full flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-24 h-full cursor-grab active:cursor-grabbing"
            >
              {/* Left: House Name, Faculty, Caption */}
              <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left gap-4 px-2" style={{ minWidth: 280, maxWidth: 400 }}>
                <span style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                  {house.faculty[storyLang]}
                </span>
                {house.houseName && (
                  <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af" }}>
                    {house.houseName}
                  </span>
                )}
                {house.caption && (
                  <p style={{ fontSize: "clamp(15px, 2vw, 18px)", fontWeight: 600, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
                    {house.caption[storyLang]}
                  </p>
                )}
              </div>

              {/* Right: Flag — rightmost, big on desktop; centered and
                  shorter on mobile so the section fits closer to one
                  viewport instead of forcing a long scroll past a
                  desktop-sized flag box. */}
              <div
                className="flex-1 w-full flex items-center justify-center lg:justify-end h-[48svh] min-h-[300px] lg:h-[80svh] lg:min-h-[400px] lg:translate-x-24 lg:translate-y-16"
                style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.55))" }}
              >
                {house.flagModelSrc ? (
                  <FlagFlutter3D src={house.flagModelSrc} prefersReducedMotion={prefersReducedMotion} />
                ) : house.flagSrc ? (
                  <div className="relative w-full h-full max-w-[300px]">
                    <Image src={house.flagSrc} alt={`${house.faculty.en} flag`} fill style={{ objectFit: "contain" }} sizes="(max-width: 768px) 90vw, 300px" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <ImageOff size={26} strokeWidth={1.5} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {storyLang === "th" ? "เร็ว ๆ นี้" : "Coming soon"}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Pagination Dots */}
        <div className="flex gap-3 mt-4 lg:mt-8 z-20">
          {houses.map((h, idx) => (
            <button
              key={idx}
              onClick={() => goToHouse(idx)}
              aria-label={`${storyLang === "th" ? "ไปที่ธง" : "Go to flag"} ${h.faculty[storyLang]}`}
              aria-current={idx === activeIndex}
              className="touch-target flex items-center justify-center"
              style={{ width: 32, height: 32 }}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === activeIndex ? "bg-white scale-125" : "bg-white/20"}`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function HousesCarousel({
  storyLang,
  phase,
  flash,
  onEnter
}: {
  storyLang: "th" | "en";
  phase: "door" | "carousel";
  flash: boolean;
  onEnter: () => void;
}) {
  return (
    <section
      className={
        phase === "carousel"
          ? // lg:min-h only (not a universal min-height): below lg the banner's
            // own 2.4:1 aspect ratio already fills a healthy share of a narrow
            // viewport, and forcing extra height there is exactly what used to
            // letterbox it into a thin strip between two huge empty bars. At
            // lg+ the banner is comfortably shorter than the viewport, so
            // without a min-height here to center within, items-center has
            // nothing to do and the banner ends up glued to the very top with
            // a dead gap below it instead of sitting centered on screen.
            "relative flex items-center justify-center w-full overflow-hidden lg:min-h-[90svh]"
          : "relative flex flex-col items-center justify-center px-6 py-14 lg:py-20 w-full overflow-hidden"
      }
      style={phase === "door" ? { minHeight: "100svh" } : undefined}
    >
      {/* Flash overlay */}
      <div
        className="fixed inset-0 bg-white z-[100] pointer-events-none transition-opacity"
        style={{ opacity: flash ? 1 : 0, transitionDuration: "1000ms" }}
      />

      {phase === "door" && (
        <div className="relative w-full max-w-7xl mx-auto flex items-center justify-center" style={{ minHeight: "80svh" }}>
          <div className="relative w-full flex flex-col items-center justify-center" style={{ height: "80svh" }}>
            <div className="w-full h-full">
              <DoorCastle3D onEnter={onEnter} />
            </div>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm tracking-widest uppercase font-bold animate-pulse text-center w-full">
              {storyLang === "th" ? "คลิกที่ประตูเพื่อเข้าสู่ปราสาท" : "Click the door to enter"}
            </p>
          </div>
        </div>
      )}

      {phase === "carousel" && (
        // Full-width (edge-to-edge) banner reveal — replaces the old
        // per-house carousel/grid entirely. The image itself is sized
        // purely by its own 3240x1350 aspect ratio (no object-cover crop,
        // so the full banner including its edges is always visible); on
        // lg+ viewports the parent <section>'s lg:min-h-[90svh] then
        // centers it vertically via that section's flex items-center /
        // justify-center (see the section's className comment for why
        // that min-height is lg-only, not universal).
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease: "easeOut" }}
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "3240 / 1350" }}
        >
          <Image
            src="/songsue-banner.webp"
            alt={storyLang === "th" ? "แบนเนอร์ สองสื่อ" : "Songsue banner"}
            fill
            className="object-contain"
            sizes="100vw"
            priority
          />
        </motion.div>
      )}
    </section>
  );
}

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
  
  const [doorPhase, setDoorPhase] = useState<"door" | "carousel">("door");
  const [flash, setFlash] = useState(false);
  const houseSectionRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleEnter = () => {
    setFlash(true);
    setTimeout(() => {
      setDoorPhase("carousel");
      setFlash(false);
    }, 1000);
  };

  // FlagsCarousel (section 2) unmounts and the door section collapses from
  // 100svh down to the banner's natural (much shorter) height the instant
  // doorPhase flips — with no scroll compensation the browser clamps the
  // scroll offset to the new, shorter page and the banner ends up scrolled
  // past. Recenter on the section so the banner actually appears in view.
  // Scroll to its top, not center: the Hero section above (section 1) is
  // always mounted at 100svh regardless of doorPhase, so centering the much
  // shorter banner section pulls half a screen of the Hero's empty tail
  // into view above it. Scrolling its start to the top of the viewport
  // instead puts the banner immediately in view with nothing above it.
  //
  // A single scrollIntoView call isn't enough here: this page mixes
  // Next/Image layout (banner), a WebGL canvas remount (the door canvas
  // unmounting), and a Framer Motion whileInView reveal (the CTA card) —
  // between them the document height keeps settling for a couple hundred ms
  // after the phase flip, and the browser's native scroll anchoring nudges
  // scrollY to compensate as that happens, dragging the banner back down
  // out from under a one-shot scroll. So instead of scrolling once, we
  // re-assert the target every time a ResizeObserver sees the page's height
  // change, for a short window after entering — and bail out immediately if
  // the user starts scrolling/touching themselves so we never fight them.
  // Every re-assert (including the first) uses "instant", never "smooth":
  // a "smooth" scroll animates over ~300-500ms, and if a ResizeObserver
  // firing mid-animation snapped the page to a new target with "instant" it
  // would cut that animation off half-finished — visibly yanking the banner
  // out from under itself right as it first comes into view, since this
  // settle window is exactly when the layout (and therefore the target) is
  // still moving. Snapping the whole way through avoids that tug-of-war.
  useEffect(() => {
    if (doorPhase !== "carousel") return;

    let stopped = false;
    let resizeObserver: ResizeObserver | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      stopped = true;
      resizeObserver?.disconnect();
      if (settleTimer !== null) clearTimeout(settleTimer);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };

    const scrollToBanner = () => {
      if (stopped || !houseSectionRef.current) return;
      const target = houseSectionRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: target, behavior: "instant" });
    };

    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        if (stopped) return;
        scrollToBanner();
        resizeObserver = new ResizeObserver(() => scrollToBanner());
        resizeObserver.observe(document.body);
        settleTimer = setTimeout(stop, 1200);
      });
      rafRef.current = raf2;
    });
    rafRef.current = raf1;

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stop();
    };
  }, [doorPhase]);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : -80]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, prefersReducedMotion ? 1 : 0.92]);

  const reveal = prefersReducedMotion
    ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: false, amount: 0.4 }, transition: { duration: 0.5 } }
    : { initial: { opacity: 0, y: 40 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: false, amount: 0.4 }, transition: { duration: 0.7, ease: EASE_OUT } };

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
      <div ref={heroRef} className="relative flex flex-col items-center justify-center text-center px-6" style={{ minHeight: "100svh" }}>
        <motion.div
          style={prefersReducedMotion ? undefined : { opacity: heroOpacity, y: heroY, scale: heroScale }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
          className="flex flex-col items-center gap-6 max-w-3xl"
        >
          <h1
            className="landing-title"
            style={{
              fontSize: "clamp(32px, 14vw, 140px)",
              fontWeight: 950,
              color: "rgba(255,255,255,0.97)",
              lineHeight: 0.95,
              letterSpacing: "-0.03em",
              whiteSpace: "nowrap",
            }}
          >
            <span
              className="gradient-text"
              style={{ backgroundImage: "linear-gradient(135deg, #111827 0%, #ffffff 100%)" }}
            >
              {copy.hero.titleTh}
            </span>
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

      {/* Section 2 - Animated 3D flag carousel, one house at a time.
          Hidden once the door has been entered — it's a pre-castle tease,
          not something that should stick around once section 03 takes over. */}
      {doorPhase === "door" && (
        <FlagsCarousel
          houses={houses}
          storyLang={storyLang}
          prefersReducedMotion={!!prefersReducedMotion}
          copy={copy}
        />
      )}

      {/* Section 3 - Door intro, then the full-bleed songsue-banner.png reveal */}
      <div ref={houseSectionRef}>
        <HousesCarousel
          storyLang={storyLang}
          phase={doorPhase}
          flash={flash}
          onEnter={handleEnter}
        />
      </div>

      {/* Visual separator between the banner and the CTA — plain margin alone
          is invisible here since both sections sit on the same solid black
          page background, so a subtle divider line is what actually reads
          as "a gap" instead of just more black space. py-* here (not on the
          CTA section) is the single source of the gap at every breakpoint,
          so mobile and desktop both get real, visible spacing.
          The "!" (Tailwind v4 important) on every spacing class below is
          load-bearing, not decorative: globals.css:49 has an unlayered
          universal selector zeroing padding, and per the CSS Cascade Layers
          spec an unlayered rule always beats a layered one (Tailwind's own
          utilities live in the "utilities" layer) regardless of source
          order or specificity — so plain px-6, py-8 etc classes here
          silently no-op. Don't simplify these back to bare utility classes. */}
      {doorPhase === "carousel" && (
        <div className="w-full flex justify-center px-6! py-8! sm:py-10! lg:py-14!">
          <div
            className="w-full max-w-xs h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)" }}
          />
        </div>
      )}

      {/* ── CTA / Register ───────────────────────────────────────────────── */}
      {doorPhase === "carousel" && (
      <motion.section
        {...reveal}
        className="relative flex flex-col items-center justify-center text-center px-6! py-12! sm:py-16! lg:py-24!"
        /* 90svh (not a rounder 70/80svh) is deliberate: the scroll-into-view
           effect above needs (banner + divider + this section) to add up to
           at least one full viewport so the browser has room to actually
           scroll the banner flush to the top — anything shorter gets clamped
           by the max scroll position, leaving a leftover strip of the Hero
           section stuck above the banner. Verified against 390x844 and
           1440x900; don't shrink this without re-checking the flush at both. */
        style={{ minHeight: "90svh" }}
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
            {variant !== "login" && <span style={kickerStyle}>{copy.cta.kicker}</span>}
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
              className="btn songsue-cta-btn btn-full touch-target"
              style={{
                height: "clamp(60px, 7vw, 72px)",
                borderRadius: "clamp(18px, 2vw, 22px)",
                fontSize: "clamp(16px, 2vw, 18px)",
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
                className="btn songsue-cta-btn btn-full touch-target"
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
      )}

      {/* Scoped to this page only — the shared .btn-primary class elsewhere in
          the app stays on the brand orange; this landing page alone uses a
          monochrome black/white/grey palette. */}
      <style jsx>{`
        .songsue-cta-btn {
          background: #f3f4f6;
          color: #0a0a0a;
          box-shadow: 0 28px 56px rgba(255, 255, 255, 0.14);
        }
        .songsue-cta-btn:hover:not(:disabled) {
          background: #ffffff;
          box-shadow: 0 28px 56px rgba(255, 255, 255, 0.22), 0 4px 12px rgba(0, 0, 0, 0.4);
          transform: translateY(-1px);
        }
        .songsue-cta-btn:active:not(:disabled) {
          transform: scale(0.97);
        }
      `}</style>
    </div>
  );
}
