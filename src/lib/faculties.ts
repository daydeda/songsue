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
  { id: "MASSCOM", name: "MassComm", majors: [] },
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
