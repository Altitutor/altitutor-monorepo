"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function LoginPageLayout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const logoSrc =
    resolvedTheme === "dark"
      ? "/images/logo-banner-dark.svg"
      : "/images/logo-banner-light.svg";

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      {/* Floating header */}
      <header className="fixed left-0 right-0 top-0 z-10 flex items-center justify-between p-4">
        <Image
          src={logoSrc}
          alt="Altitutor"
          width={140}
          height={32}
          className="h-10 w-auto object-contain object-left"
          priority
        />
        <ThemeToggle />
      </header>

      {/* Main content: title + card */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Altitutor UCAT System
        </h1>
        {children}
      </main>
    </div>
  );
}
