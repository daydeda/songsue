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
    flagModelSrc: "/flag_house/Masscom_flag.glb",
    characterSrc: null,
    faculty: { th: "คณะการสื่อสารมวลชน", en: "Mass Communication" },
    houseName: "MassFenrir",
    caption: {
      th: "ณ ดินแดนที่กาลเวลาไม่อาจลบเลือนตำนาน มีเรื่องเล่าถึงอสูรร้ายผู้หนึ่ง ผู้ซึ่งแม้แต่เหล่าทวยเทพยังมิอาจสยบ พวกเขาจึงเลือก \"พันธนาการ\" แทนการทำลาย หลายศตวรรษผ่านพ้น โซ่ตรวนที่เคยหลับใหลเริ่มสั่นสะเทือนอีกครั้ง และตำนานที่ถูกลืม กำลังจะตื่นขึ้น... MASSFENRIR คือดินแดนที่หล่อหลอมผู้กล้าให้เรียนรู้การอยู่ร่วมกันกับพลังอันยิ่งใหญ่ และเปลี่ยนตำนานที่น่าหวาดกลัว ให้กลายเป็นสัญลักษณ์แห่งความกล้าหาญ",
      en: "In a land where time can never erase a legend, there is a tale of a fearsome beast that even the gods could not subdue — so they chose to bind it in chains rather than destroy it. Centuries have passed, and the shackles that once lay dormant begin to stir again; the forgotten legend is awakening... Massfenrir is the land that forges the brave to learn to live alongside overwhelming power, turning a legend once feared into a symbol of courage.",
    },
  },
  {
    id: "architecture",
    flagSrc: null,
    flagModelSrc: "/flag_house/architecture_flag.glb",
    characterSrc: null,
    faculty: { th: "คณะสถาปัตยกรรมศาสตร์", en: "Architecture" },
    houseName: "CHRONOKINESIS",
    caption: {
      th: "ณ ดินแดนที่ไร้ซึ่งกฎเกณฑ์แห่งกาลเวลา มีเพียง 'ผู้พิทักษ์แห่งกาลเวลา' เท่านั้นที่คอยรักษาสมดุลแห่งอดีต ปัจจุบัน และอนาคต — สถาบัน “CHRONOKINESIS” คือสถานที่ซึ่งหล่อหลอมผู้พิทักษ์เหล่านั้นขึ้นมา",
      en: "In a land beyond the laws of time, only the Guardians of Time keep the balance of past, present, and future — Chronokinesis is where those guardians are forged.",
    },
  },
  {
    id: "camt",
    flagSrc: null,
    flagModelSrc: "/flag_house/camt_flag.glb",
    characterSrc: null,
    faculty: { th: "วิทยาลัยศิลปะ สื่อ และเทคโนโลยี", en: "College of Arts, Media and Technology" },
    houseName: "Ashkayn",
    caption: {
      th: "ณ ดินแดนที่เปลวเพลิงไม่มีวันมอดดับ และความตายไม่ใช่จุดจบของทุกสิ่ง แม้เพียงเศษเถ้าถ่านก็กลายเป็นปาฏิหาริย์แห่งชีวิตใหม่ได้ ASHKAYN คือสถานที่ซึ่งซ่อนเร้นเปลวเพลิงศักดิ์สิทธิ์ที่หลับไหล ซึ่งหล่อหลอมจิตวิญญาณแห่งความหวังให้ฟื้นตื่นและโบยบินขึ้นมาอีกครั้ง",
      en: "In a land where flame never dies and death is not the end of all things, even ash can become a miracle of new life. Ashkayn is where a sleeping sacred flame lies hidden, forging spirits of hope to awaken and rise again.",
    },
  },
  {
    id: "fine-arts",
    flagSrc: null,
    flagModelSrc: "/flag_house/Fine_art_flag.glb",
    characterSrc: null,
    faculty: { th: "คณะวิจิตรศิลป์", en: "Fine Arts" },
    houseName: "Ancestral Incantation",
    caption: {
      th: "ณ ดินแดนแห่งนึง ความเชื่อไม่เคยเลือนหาย ทุกสายลมพัดพาเสียงคาถา ทุกฝีก้าวซ่อนร่องรอยของพิธีกรรมโบราณ จากรุ่นสู่รุ่น วิชาอาคม เครื่องราง และการ “บายศรี” ไม่ใช่เพียงเรื่องเล่า หากแต่เป็นมรดกทางวัฒนธรรมที่หล่อหลอมผู้คนให้เคารพทั้งธรรมชาติ บรรพชน และสิ่งเร้นลับ",
      en: "In a land where belief never fades, every breeze carries the sound of incantations, and every footstep hides the trace of ancient rites. Passed down through generations, sorcery, talismans, and the sacred Baisri are not mere legend but a cultural inheritance that teaches reverence for nature, ancestors, and the unseen.",
    },
  },
];
