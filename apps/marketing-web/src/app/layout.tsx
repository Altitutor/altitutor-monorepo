import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  IBM_Plex_Mono,
  Outfit,
  Plus_Jakarta_Sans,
} from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { MarketingPostHogProvider } from "@/lib/analytics/posthog-provider";

const heading = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "800"],
  variable: "--font-heading",
  display: "swap",
});

const body = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const editorial = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
});

const label = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-label",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-AU"
      className={`${heading.variable} ${body.variable} ${editorial.variable} ${label.variable}`}
    >
      <body>
        <MarketingPostHogProvider>{children}</MarketingPostHogProvider>
      </body>
    </html>
  );
}
