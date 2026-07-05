export type SongsueCopy = {
  hero: {
    kicker: string;
    titleTh: string;
    titleEn: string;
    tagline: string;
    scrollHint: string;
  };
  sections: {
    kicker: string;
    title: string;
    body: string;
  }[];
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
      kicker: "SMO CAMT นำเสนอ",
      titleTh: "สองสื่อ",
      titleEn: "Songsue",
      tagline: "เมื่อสื่อสองรูปแบบมาบรรจบกัน เรื่องราวใหม่จึงเริ่มต้น",
      scrollHint: "เลื่อนลงเพื่อฟังเรื่องราว",
    },
    sections: [
      {
        kicker: "01 — จุดเริ่มต้น",
        title: "เรื่องราวของสื่อสองรูปแบบ",
        body:
          "ภาพนิ่งจับเวลาไว้ในหนึ่งช่วงขณะ ภาพเคลื่อนไหวเล่าเรื่องผ่านการเดินทางของเวลา สองสื่อคือพื้นที่ที่ทั้งสองโลกนี้มาบรรจบกัน — ที่ซึ่งนักเล่าเรื่องรุ่นใหม่ทดลอง ผสาน และค้นพบภาษาภาพในรูปแบบของตัวเอง",
      },
      {
        kicker: "02 — สิ่งที่รอคุณอยู่",
        title: "สิ่งที่รอคุณอยู่",
        body:
          "เวิร์กช็อปจากครีเอเตอร์ตัวจริง นิทรรศการที่เปลี่ยนทุกมุมของงานให้เป็นแกลเลอรี และเวทีที่เปิดให้ผลงานของคุณได้ฉายแสง — ทั้งหมดนี้ออกแบบมาเพื่อคนที่มองเห็นเรื่องราวในทุกเฟรม",
      },
      {
        kicker: "03 — เข้าร่วมกับเรา",
        title: "ร่วมเป็นส่วนหนึ่งของเรื่องราวนี้",
        body:
          "ไม่ว่าคุณจะถือกล้อง ถือปากกา หรือแค่มีเรื่องอยากเล่า สองสื่อคือพื้นที่ของคุณ ลงทะเบียนเพื่อจองที่ของคุณในงานที่จะรวมนักสร้างสรรค์จากทั่วคณะไว้ในที่เดียว",
      },
    ],
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
      kicker: "SMO CAMT Presents",
      titleTh: "สองสื่อ",
      titleEn: "Songsue",
      tagline: "Where two forms of media meet, a new story begins.",
      scrollHint: "Scroll to hear the story",
    },
    sections: [
      {
        kicker: "01 — The Beginning",
        title: "The story of two media",
        body:
          "A still image holds a single moment. A moving image carries you through time. Songsue is the space where both worlds meet — where a new generation of storytellers experiment, blend, and discover a visual language of their own.",
      },
      {
        kicker: "02 — What Awaits You",
        title: "What awaits you",
        body:
          "Workshops led by working creators, an exhibition that turns every corner of the venue into a gallery, and a stage built for your work to be seen. Everything here is made for people who see a story in every frame.",
      },
      {
        kicker: "03 — Join Us",
        title: "Become part of the story",
        body:
          "Whether you hold a camera, a pen, or simply a story worth telling, Songsue is your space. Register to claim your place at an event that brings creators from across the faculty together in one room.",
      },
    ],
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
