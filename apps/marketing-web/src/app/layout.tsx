import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import clsx from "clsx";
import "./globals.css";
import { MarketingPostHogProvider } from "@/lib/analytics/posthog-provider";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const bodyFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const headingFont = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["italic"],
  variable: "--font-cormorant-garamond",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | Adelaide tutoring for SACE, UCAT and school students`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Altitutor provides Adelaide tutoring for Year 1-12, SACE, IB, UCAT preparation, exam revision and English drafting from its CBD learning centre.",
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "education",
  keywords: [
    "Adelaide tutoring",
    "Adelaide tutor",
    "SACE tutoring Adelaide",
    "UCAT tutoring Adelaide",
    "Year 12 tutoring Adelaide",
    "Maths tutor Adelaide",
    "Science tutor Adelaide",
    "English tutor Adelaide",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" className={clsx(bodyFont.variable, headingFont.variable, displayFont.variable, monoFont.variable)}>
      <body><MarketingPostHogProvider>{children}</MarketingPostHogProvider></body>
    </html>
  );
}
