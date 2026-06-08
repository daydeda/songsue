import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai, Noto_Sans_Myanmar, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-sans",
  display: "swap",
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-ibm-thai",
  display: "swap",
});

const notoSansMyanmar = Noto_Sans_Myanmar({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["myanmar", "latin"],
  variable: "--font-noto-myanmar",
  display: "swap",
});

const notoSansSC = Noto_Sans_SC({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-sc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActiveCAMT — CAMT Student Activity Hub",
  description:
    "The official student activity management platform for CAMT, Chiang Mai University. Register for events, track your house points, and manage attendance.",
  keywords: ["CAMT", "CMU", "student activities", "house points", "attendance"],
  icons: {
    icon: "/smocamt-logo.png",
  },
};

import { SessionProvider } from "@/components/providers/SessionProvider";
import { LanguageProvider } from "@/lib/LanguageContext";
import { LanguageWrapper } from "@/lib/LanguageWrapper";

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
            <SessionProvider>{children}</SessionProvider>
          </LanguageWrapper>
        </LanguageProvider>
      </body>
    </html>
  );
}
