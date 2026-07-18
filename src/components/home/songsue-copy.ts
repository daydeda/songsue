export type SongsueCopy = {
  hero: {
    titleTh: string;
    titleEn: string;
    tagline: string;
    scrollHint: string;
  };
  houses: {
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
    houses: {
      kicker: "02 — บ้านของคุณ",
      title: "สี่บ้าน สี่เรื่องราว",
    },
    cta: {
      kicker: "ลงทะเบียนเข้าร่วมงาน",
      title: "พร้อมเริ่มเรื่องราวของคุณหรือยัง?",
      body: "การลงทะเบียนจะเปิดในวันที่ 24 กรกฎาคม — กดติดตามนับถอยหลังไว้ แล้วมาเจอกัน",
      lockedLabel: "เปิดลงทะเบียนในอีก",
      unlockedLabel: "ลงทะเบียนด้วย Google",
      dateNote: "เปิดลงทะเบียน 24 กรกฎาคม 2569",
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
    houses: {
      kicker: "02 — Your House",
      title: "Four houses, four stories",
    },
    cta: {
      kicker: "Register for the event",
      title: "Ready to start your story?",
      body: "Registration opens on July 24 — watch the countdown, and we'll see you there.",
      lockedLabel: "Registration opens in",
      unlockedLabel: "Register with Google",
      dateNote: "Registration opens July 24, 2026",
    },
    langToggleLabel: "TH",
  },
};
