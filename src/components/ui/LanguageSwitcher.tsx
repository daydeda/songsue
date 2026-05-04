"use client";

import { useLanguage } from "@/lib/LanguageContext";
import { Language } from "@/lib/i18n";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "th", label: "ไทย", flag: "🇹🇭" },
    { code: "mm", label: "မြန်မာ", flag: "🇲🇲" },
    { code: "cn", label: "中文", flag: "🇨🇳" },
  ];

  const currentLang = languages.find((l) => l.code === lang) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderRadius: 14,
          background: isOpen ? "var(--bg-elevated)" : "rgba(255,107,0,0.05)",
          border: `1px solid ${isOpen ? "var(--border-medium)" : "transparent"}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
          color: "var(--text-primary)",
        }}
      >
        <Globe size={16} className={isOpen ? "text-accent" : "text-muted"} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{currentLang.flag} {currentLang.label}</span>
        <ChevronDown size={14} style={{ 
          opacity: 0.5, 
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s"
        }} />
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 180,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(16px)",
          borderRadius: 18,
          border: "1px solid var(--border-medium)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
          padding: 8,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          animation: "fade-in-down 0.2s ease-out"
        }}>
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setIsOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: lang === l.code ? 800 : 600,
                background: lang === l.code ? "rgba(255,107,0,0.08)" : "transparent",
                color: lang === l.code ? "var(--accent-primary)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                textAlign: "left"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>{l.flag}</span>
                {l.label}
              </div>
              {lang === l.code && <Check size={14} />}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
