"use client";

import type { ReactNode } from "react";
import { MagneticButton } from "@/features/landing/components/marketing/magnetic-button";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

type PlanPickerCtaVariant = "free" | "proAccent" | "monthlyFeatured";

/** Matches landing hero “Sign up for in-person” (outline) vs filled accent CTAs. */
const VARIANT_CLASS: Record<PlanPickerCtaVariant, string> = {
  free: "border border-marketing-charcoal/30 bg-transparent text-marketing-charcoal hover:bg-marketing-charcoal/5",
  proAccent:
    "bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/30",
  monthlyFeatured:
    "bg-marketing-accent text-marketing-charcoal shadow-lg shadow-marketing-accent/30",
};

type PlanPickerCtaProps = {
  variant: PlanPickerCtaVariant;
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

export function PlanPickerCta({
  variant,
  children,
  disabled,
  onClick,
  className,
}: PlanPickerCtaProps) {
  return (
    <MagneticButton
      disabled={disabled}
      className={cn(
        "mt-10 w-full px-6 py-4 text-base font-semibold tracking-wide",
        VARIANT_CLASS[variant],
        typo.headingSans,
        className,
      )}
      onClick={onClick}
    >
      {children}
    </MagneticButton>
  );
}
