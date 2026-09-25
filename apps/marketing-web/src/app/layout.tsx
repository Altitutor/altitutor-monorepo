import type { Metadata } from "next";
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
        <svg className="noiseOverlay" aria-hidden="true">
          <filter id="marketing-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#marketing-noise)" />
        </svg>
        <MarketingPostHogProvider>{children}</MarketingPostHogProvider>
      </body>
    </html>
  );
}
