import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const thaiFont = IBM_Plex_Sans_Thai({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  variable: "--font-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ActiveCAMT — CAMT Student Activity Hub",
  description:
    "The official student activity management platform for CAMT, Chiang Mai University. Register for events, track your house points, and manage attendance.",
  keywords: ["CAMT", "CMU", "student activities", "house points", "attendance"],
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
    <html lang="en" className={`${inter.variable} ${thaiFont.variable} h-full`}>
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
