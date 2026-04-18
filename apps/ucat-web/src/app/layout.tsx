import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UCAT Web",
  description: "UCAT practice app",
  icons: {
    icon: [
      {
        url: "/images/logo-icon-light.svg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/images/logo-icon-dark.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/images/logo-icon-light.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
