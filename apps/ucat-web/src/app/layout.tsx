import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { UcatPostHogProvider } from "@/lib/analytics/posthog-provider";
import { UCAT_PRODUCT_DESCRIPTION, UCAT_PRODUCT_NAME } from "@/lib/ucat-brand";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: UCAT_PRODUCT_NAME,
  description: UCAT_PRODUCT_DESCRIPTION,
  robots: {
    index: false,
    follow: false,
  },
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
        <UcatPostHogProvider>
          <AppProviders>{children}</AppProviders>
        </UcatPostHogProvider>
      </body>
    </html>
  );
}
