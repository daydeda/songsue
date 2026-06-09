
"use client";

import { useLanguage } from "./LanguageContext";

export function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();

  const getFontFamily = (l: string) => {
    switch (l) {
      case "th":
        return "var(--font-ibm-sans), var(--font-ibm-thai), sans-serif";
      case "mm":
        return "var(--font-ibm-sans), var(--font-noto-myanmar), sans-serif";
      case "cn":
        return "var(--font-ibm-sans), var(--font-noto-sc), sans-serif";
      default:
        return "var(--font-ibm-sans), sans-serif";
    }
  };

  return (
    <div 
      className={`lang-${lang}`}
      style={{ 
        fontFamily: getFontFamily(lang),
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
