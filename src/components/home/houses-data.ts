export type HouseInfo = {
  id: string;
  flagSrc: string | null;
  // Animated 3D flag (.glb) — takes priority over flagSrc when present.
  flagModelSrc: string | null;
  // No house has character art yet — kept as a field so it's a one-line
  // change to wire up once assets exist, instead of restructuring the type.
  characterSrc: string | null;
  faculty: { th: string; en: string };
  houseName: string | null;
  caption: { th: string; en: string } | null;
};

export const houses: HouseInfo[] = [
  {
    id: "masscom",
    flagSrc: null,
    flagModelSrc: "/flag_house/flag_fineart.glb",
    characterSrc: null,
    faculty: { th: "คณะการสื่อสารมวลชน", en: "MASSCOM" },
    houseName: null,
    caption: null,
  },
  {
    id: "architecture",
    flagSrc: "/flag_house/Chorono-Archi.png",
    flagModelSrc: "/flag_house/flag_fineart.glb",
    characterSrc: null,
    faculty: { th: "คณะสถาปัตยกรรมศาสตร์", en: "Architecture" },
    houseName: "CHRONOKINESIS",
    caption: {
      th: "เวทมนตรแห่งการเเปรผัน กาลละเวลา",
      en: "The sorcery of transformation through time",
    },
  },
  {
    id: "camt",
    flagSrc: "/flag_house/Ashkayn-CAMT.png",
    flagModelSrc: "/flag_house/flag_fineart.glb",
    characterSrc: null,
    faculty: { th: "วิทยาลัยศิลปะ สื่อ และเทคโนโลยี", en: "College of Arts, Media and Technology" },
    houseName: "Ashkayn",
    caption: {
      th: "เมื่อทุกสิ่งมอดไหม้ แสงสว่างจะตื่นขึ้นอีกครั้ง",
      en: "When everything burns to ash, the light awakens once again",
    },
  },
  {
    id: "fine-arts",
    flagSrc: null,
    flagModelSrc: "/flag_house/flag_fineart.glb",
    characterSrc: null,
    faculty: { th: "คณะวิจิตรศิลป์", en: "Fine Arts" },
    houseName: null,
    caption: null,
  },
];
