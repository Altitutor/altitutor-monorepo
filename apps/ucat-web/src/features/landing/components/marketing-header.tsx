"use client";
import { Button } from "@/components/ui/button";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/features/auth";
import { UCAT_APP_HEADER_RULE } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function MarketingHeader() {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const logoSrc =
    resolvedTheme === "dark"
      ? "/images/logo-banner-dark.svg"
      : "/images/logo-banner-light.svg";

  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-50 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        UCAT_APP_HEADER_RULE,
      )}
    >
      <Link href="/" className="flex items-center">
        <Image
          src={logoSrc}
          alt="Altitutor"
          width={120}
          height={28}
          className="h-8 w-auto object-contain"
          priority
        />
      </Link>
      <nav className="flex items-center gap-4">
        {user ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log in</Link>
          </Button>
        )}
        <Button size="sm" asChild>
          <Link href="/subscribe">
            {user ? "Subscribe" : "Get started"}
          </Link>
        </Button>
        <ThemeToggle />
      </nav>
    </header>
  );
}
