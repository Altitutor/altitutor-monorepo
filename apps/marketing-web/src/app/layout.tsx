import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME, SITE_URL } from "@/lib/site";

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
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
