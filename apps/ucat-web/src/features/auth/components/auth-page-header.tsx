"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

const backButtonClassName = cn(
  typo.secondarySans,
  "inline-flex items-center gap-0.5 text-sm tracking-wide",
  "text-muted-foreground opacity-80 transition-colors duration-200 ease-out",
  "hover:text-primary hover:opacity-100",
);

type AuthPageHeaderProps = {
  backLabel?: string;
  backHref?: string;
  onBack?: () => void;
};

export function AuthPageHeader({
  backLabel = "Home",
  backHref = "/",
  onBack,
}: AuthPageHeaderProps) {
  return (
    <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className={backButtonClassName}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </button>
      ) : (
        <Link href={backHref} aria-label={backLabel} className={backButtonClassName}>
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>
      )}
      <ThemeToggle />
    </header>
  );
}
