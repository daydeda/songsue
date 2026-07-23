import localFont from "next/font/local";

// Per-house display fonts for the flag carousel's house-name caption
// (see FlagsCarousel in SongsueLanding.tsx). All four are dafont.com
// releases — self-hosted here via next/font/local rather than linked from
// dafont directly, since dafont only serves them from a font's own
// "custom preview" page, not a stable CDN URL.
//   - Bazzotte: free for personal use (non-commercial university event site)
//   - FairyDustB, Mirage Gothic: 100% free
//   - Starstruck: license unlabeled on dafont (treat as personal-use only)

// MASSFENRIR (Mass Communication)
export const massfenrirFont = localFont({
  src: "./fonts/Bazzotte.ttf",
  display: "swap",
});

// CHRONOKINESIS (Architecture)
export const chronokinesisFont = localFont({
  src: "./fonts/Starstruck.ttf",
  display: "swap",
});

// ASHKAYN (CAMT)
export const ashkaynFont = localFont({
  src: "./fonts/MirageGothic.ttf",
  display: "swap",
});

// Ancestral Incantation (Fine Arts)
export const ancestralIncantationFont = localFont({
  src: "./fonts/FairyDustB.ttf",
  display: "swap",
});

// Keyed by HouseInfo.id (src/components/home/houses-data.ts) rather than by
// name string, since ids are the stable identifier and houseName strings
// vary in casing between houses.
export const houseNameFontClassById: Record<string, string> = {
  masscom: massfenrirFont.className,
  architecture: chronokinesisFont.className,
  camt: ashkaynFont.className,
  "fine-arts": ancestralIncantationFont.className,
};
