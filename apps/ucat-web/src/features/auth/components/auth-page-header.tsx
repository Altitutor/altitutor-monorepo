"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

export function AuthPageHeader() {
  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
      <Link
        href="/"
        aria-label="Back to landing page"
        className={cn(
          typo.secondarySans,
          "inline-flex items-center gap-0.5 text-sm tracking-wide",
          "text-muted-foreground opacity-80 transition-colors duration-200 ease-out",
          "hover:text-primary hover:opacity-100",
        )}
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Home
      </Link>
      <ThemeToggle />
    </header>
  );
}
