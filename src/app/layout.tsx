import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai, Noto_Sans_Myanmar, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

// Primary UI font (Latin), preloaded into the critical path. NOTE: do not add
// an explicit `fallback` of system fonts here — this variable sits first in the
// font-family chain, and system fonts (e.g. -apple-system) carry Thai glyphs,
// so they would swallow Thai text before it reaches IBM Plex Sans Thai below.
const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-sans",
  display: "swap",
  preload: true,
});

// Thai is a primary script for this audience, so preload it into the critical
// path alongside the Latin font for crisp Thai LCP text without a swap flash.
const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-ibm-thai",
  display: "swap",
  preload: true,
});

// Myanmar — rarely used. Trim to two weights and never preload (these glyph
// sets are large and were being downloaded by every user unnecessarily).
const notoSansMyanmar = Noto_Sans_Myanmar({
  weight: ["400", "700"],
  subsets: ["myanmar"],
  variable: "--font-noto-myanmar",
  display: "swap",
  preload: false,
});

// Simplified Chinese — large CJK family, rarely used. Trim weights, no preload.
const notoSansSC = Noto_Sans_SC({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sc",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "ActiveCAMT — CAMT Student Activity Hub",
  description:
    "The official student activity management platform for CAMT, Chiang Mai University. Register for events, track your house points, and manage attendance.",
  keywords: ["CAMT", "CMU", "student activities", "house points", "attendance"],
  icons: {
    icon: "/smocamt-logo-icon.png",
  },
};

import { SessionProvider } from "@/components/providers/SessionProvider";
import { LanguageProvider } from "@/lib/LanguageContext";
import { LanguageWrapper } from "@/lib/LanguageWrapper";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexSansThai.variable} ${notoSansMyanmar.variable} ${notoSansSC.variable} h-full`} data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col antialiased">
        <LanguageProvider>
          <LanguageWrapper>
            <SessionProvider>
              {children}
              <Analytics />
              <SpeedInsights />
            </SessionProvider>
          </LanguageWrapper>
        </LanguageProvider>
      </body>
    </html>
  );
}
