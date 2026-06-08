
"use client";

import { useLanguage } from "./LanguageContext";

export function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();

  return (
    <div 
      className={`lang-${lang}`}
      style={{ 
        fontFamily: 
          lang === "th" ? "var(--font-ibm-thai), sans-serif" : 
          lang === "mm" ? "var(--font-noto-myanmar), var(--font-ibm-thai), sans-serif" : 
          lang === "cn" ? "var(--font-noto-sc), var(--font-ibm-thai), sans-serif" : 
          "var(--font-ibm-sans), var(--font-ibm-thai), sans-serif",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden"
      }}
    >
      {children}
    </div>
  );
}
