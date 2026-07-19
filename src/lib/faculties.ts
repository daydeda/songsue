// The 4 collaborating faculties and the 4 shared colour houses.
//
// Houses are now per-faculty (4 faculties × 4 colours = 16 rows in the houses
// table), but the public leaderboard rolls points up by COLOUR — so a CAMT red
// house and a MASSCOM red house read as a single "red" house. See
// HousesService.getLeaderboard / pickBalancedHouseIdForFaculty.

export type FacultyId = "CAMT" | "MASSCOM" | "ARCH" | "ARTS";
export type ColorId = "red" | "green" | "yellow" | "blue";

export interface Faculty {
  id: FacultyId;
  /** Short label for UI; the translated name lives in i18n (facultyCamt/…). */
  name: string;
  /** Faculty-specific major codes. Empty → faculty has no major sub-selection yet. */
  majors: string[];
}

export const FACULTIES: Faculty[] = [
  { id: "CAMT", name: "CAMT", majors: ["ANI", "DG", "DII", "MMIT", "SE"] },
  // Real major lists for the other faculties are pending — until provided, Major
  // is optional for these faculties (no sub-selection shown). Add codes here to
  // turn on the Major dropdown for that faculty.
  { id: "MASSCOM", name: "Mass Communication", majors: [] },
  { id: "ARCH", name: "Architecture", majors: [] },
  { id: "ARTS", name: "Fine Arts", majors: [] },
];

export const FACULTY_IDS: FacultyId[] = FACULTIES.map((f) => f.id);
export const DEFAULT_FACULTY: FacultyId = "CAMT";

export const isFacultyId = (v: unknown): v is FacultyId =>
  typeof v === "string" && (FACULTY_IDS as string[]).includes(v);

/** Faculty a user belongs to, defaulting null/unknown to CAMT for back-compat. */
export const normalizeFaculty = (v: unknown): FacultyId =>
  isFacultyId(v) ? v : DEFAULT_FACULTY;

export const majorsForFaculty = (faculty: unknown): string[] =>
  FACULTIES.find((f) => f.id === normalizeFaculty(faculty))?.majors ?? [];

// Each faculty's own themed house — ONE name shared across all 4 of its colour
// variants (colour is a per-student visual/balancing attribute, not part of the
// name). Matches the lore + 3D flags already built for the landing page, see
// src/components/home/houses-data.ts.
export const FACULTY_HOUSE_NAMES: Record<FacultyId, string> = {
  CAMT: "Ashkayn",
  MASSCOM: "MASSFENRIR",
  ARCH: "CHRONOKINESIS",
  ARTS: "Ancestral Incantation",
};

export const facultyHouseName = (faculty: unknown): string =>
  FACULTY_HOUSE_NAMES[normalizeFaculty(faculty)];

// The animated 3D flag (.glb, public/flag_house/) for each faculty's house —
// same assets already used on the landing page, see src/components/home/houses-data.ts.
export const FACULTY_FLAG_SRC: Record<FacultyId, string> = {
  CAMT: "/flag_house/camt_flag.glb",
  MASSCOM: "/flag_house/Masscom_flag.glb",
  ARCH: "/flag_house/architecture_flag.glb",
  ARTS: "/flag_house/Fine_art_flag.glb",
};

export const facultyFlagSrc = (faculty: unknown): string =>
  FACULTY_FLAG_SRC[normalizeFaculty(faculty)];

// Signature colour of each faculty's flag/banner (sampled from the .glb art),
// used to tint the house name label so it visually matches its flag.
export const FACULTY_ACCENT_COLOR: Record<FacultyId, string> = {
  CAMT: "#b91c1c", // Ashkayn — crimson banner, gold flame emblem
  MASSCOM: "#52525b", // MASSFENRIR — gunmetal grey banner
  ARCH: "#7c3aed", // CHRONOKINESIS — violet banner
  ARTS: "#7c2d12", // Ancestral Incantation — burnt umber banner
};

export const facultyAccentColor = (faculty: unknown): string =>
  FACULTY_ACCENT_COLOR[normalizeFaculty(faculty)];

/** The faculty a house row id belongs to — reverses houseRowId's encoding
 *  ('red' → CAMT, 'masscom-red' → MASSCOM, …). Unrecognised ids default to
 *  CAMT, matching normalizeFaculty's back-compat behaviour. */
export const facultyOfHouseId = (houseId: string | null | undefined): FacultyId => {
  if (!houseId || !houseId.includes("-")) return DEFAULT_FACULTY;
  const prefix = houseId.slice(0, houseId.indexOf("-"));
  return FACULTY_IDS.find((f) => f.toLowerCase() === prefix) ?? DEFAULT_FACULTY;
};

/** A house row id's display name — its faculty's single themed house name. */
export const houseDisplayName = (houseId: string | null | undefined): string =>
  FACULTY_HOUSE_NAMES[facultyOfHouseId(houseId)];

// The 4 shared colour houses. `name` mirrors the seed/i18n house names; `color`
// is the display hex (kept in sync with src/db/seed.ts).
export interface HouseColor {
  id: ColorId;
  name: string;
  color: string;
}

export const COLORS: HouseColor[] = [
  { id: "red", name: "Mom", color: "#ef4444" },
  { id: "green", name: "To", color: "#94a3b8" },
  { id: "yellow", name: "Luang", color: "#3b82f6" },
  { id: "blue", name: "Makon", color: "#22c55e" },
];

export const COLOR_IDS: ColorId[] = COLORS.map((c) => c.id);

/** Stable per-faculty house id. CAMT keeps the bare colour id so legacy house_id
 *  foreign keys (users.house_id, score_history.house_id) never have to move. */
export const houseRowId = (faculty: FacultyId, color: ColorId): string =>
  faculty === "CAMT" ? color : `${faculty.toLowerCase()}-${color}`;

/** The colour group ('red'…) a house id belongs to. Works for both the bare
 *  CAMT ids ('red') and the '<faculty>-<colour>' ids ('masscom-red'). Returns
 *  null for an unrecognised id. */
export const colorGroupOfHouseId = (houseId: string | null | undefined): ColorId | null => {
  if (!houseId) return null;
  const tail = houseId.includes("-") ? houseId.slice(houseId.lastIndexOf("-") + 1) : houseId;
  return (COLOR_IDS as string[]).includes(tail) ? (tail as ColorId) : null;
};

/** All 16 (faculty, colour) house rows, in a stable order. */
export const ALL_HOUSE_ROWS: { id: string; faculty: FacultyId; color: HouseColor }[] =
  FACULTY_IDS.flatMap((faculty) =>
    COLORS.map((color) => ({ id: houseRowId(faculty, color.id), faculty, color })),
  );
