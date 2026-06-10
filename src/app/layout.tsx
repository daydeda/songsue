import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai, Noto_Sans_Myanmar, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

// Primary UI font (Latin). This is the only family preloaded into the critical
// path — it covers the default English UI and is the LCP text for most users.
const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-sans",
  display: "swap",
  preload: true,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

// Thai is a common script for this audience, so keep all weights but DON'T
// preload — it loads on demand (display:swap) instead of blocking first paint.
const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai"],
  variable: "--font-ibm-thai",
  display: "swap",
  preload: false,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

// Myanmar — rarely used. Trim to two weights and never preload (these glyph
// sets are large and were being downloaded by every user unnecessarily).
const notoSansMyanmar = Noto_Sans_Myanmar({
  weight: ["400", "700"],
  subsets: ["myanmar"],
  variable: "--font-noto-myanmar",
  display: "swap",
  preload: false,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

// Simplified Chinese — large CJK family, rarely used. Trim weights, no preload.
const notoSansSC = Noto_Sans_SC({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sc",
  display: "swap",
  preload: false,
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
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
