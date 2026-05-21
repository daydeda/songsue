
"use client";

import { useLanguage } from "./LanguageContext";

export function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();

  return (
    <div 
      style={{ 
        fontFamily: lang === "th" ? "var(--font-thai), sans-serif" : "var(--font-inter), sans-serif",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {children}
    </div>
  );
}
