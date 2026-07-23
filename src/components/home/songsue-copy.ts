export type SongsueCopy = {
  hero: {
    titleTh: string;
    titleEn: string;
    tagline: string;
    scrollHint: string;
  };
  flags: {
    kicker: string;
    title: string;
  };
  cta: {
    kicker: string;
    title: string;
    body: string;
    lockedLabel: string;
    unlockedLabel: string;
    dateNote: string;
  };
  langToggleLabel: string;
};

// Placeholder storytelling copy — TH is primary, EN is a direct counterpart.
// mm/cn intentionally fall back to EN at the call site (see SongsueLanding.tsx)
// rather than living in src/lib/i18n.ts, which would require full narrative
// translations in all four languages.
export const songsueCopy: Record<"th" | "en", SongsueCopy> = {
  th: {
    hero: {
      titleTh: "สองสื่อแบบศิลป์",
      titleEn: "Two Media in Arts",
      tagline: "เมื่อสื่อสองรูปแบบมาบรรจบกัน เรื่องราวใหม่จึงเริ่มต้น",
      scrollHint: "เลื่อนลงเพื่อฟังเรื่องราว",
    },
    flags: {
      kicker: "02 — ธงประจำบ้าน",
      title: "สี่บ้าน สี่ธง",
    },
    cta: {
      kicker: "ลงทะเบียนเข้าร่วมงาน",
      title: "พร้อมเริ่มเรื่องราวของคุณหรือยัง?",
      body: "เปิดลงทะเบียนแล้ววันนี้ — เข้าสู่ระบบด้วย Google แล้วมาเจอกัน",
      lockedLabel: "เปิดลงทะเบียนในอีก",
      unlockedLabel: "ลงทะเบียนด้วย Google",
      dateNote: "เปิดลงทะเบียน 23 กรกฎาคม 2569",
    },
    langToggleLabel: "EN",
  },
  en: {
    hero: {
      titleTh: "สองสื่อแบบศิลป์",
      titleEn: "Two Media in Arts",
      tagline: "Where two forms of media meet, a new story begins.",
      scrollHint: "Scroll to hear the story",
    },
    flags: {
      kicker: "02 — House Flags",
      title: "Four houses, four flags",
    },
    cta: {
      kicker: "Register for the event",
      title: "Ready to start your story?",
      body: "Registration is open — sign in with Google and we'll see you there.",
      lockedLabel: "Registration opens in",
      unlockedLabel: "Register with Google",
      dateNote: "Registration opens July 23, 2026",
    },
    langToggleLabel: "TH",
  },
};
