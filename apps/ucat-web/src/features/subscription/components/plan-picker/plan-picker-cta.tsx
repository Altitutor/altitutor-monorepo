"use client";

import type { ReactNode } from "react";
import { MagneticButton } from "@/features/landing/components/marketing/magnetic-button";
import { MARKETING_TOKENS } from "@altitutor/shared";
import {
  planPickerCtaClass,
  planPickerCurrentPlanCtaClass,
  planPickerFeaturedCurrentPlanCtaClass,
  type PlanPickerSurfaceTheme,
} from "@/features/subscription/components/plan-picker/plan-picker-surface-theme";
import { cn } from "@/lib/utils";

const { typography: typo } = MARKETING_TOKENS;

type PlanPickerCtaVariant = "free" | "proAccent" | "monthlyFeatured";

type PlanPickerCtaProps = {
  variant: PlanPickerCtaVariant;
  children: ReactNode;
  disabled?: boolean;
  isCurrentPlan?: boolean;
  onClick?: () => void;
  className?: string;
  surfaceTheme?: PlanPickerSurfaceTheme;
};

export function PlanPickerCta({
  variant,
  children,
  disabled,
  isCurrentPlan = false,
  onClick,
  className,
  surfaceTheme = "marketing",
}: PlanPickerCtaProps) {
  return (
    <MagneticButton
      disabled={disabled || isCurrentPlan}
      className={cn(
        "mt-10 w-full px-6 py-4 text-base font-semibold tracking-wide",
        isCurrentPlan
          ? variant === "monthlyFeatured"
            ? planPickerFeaturedCurrentPlanCtaClass()
            : planPickerCurrentPlanCtaClass(surfaceTheme)
          : planPickerCtaClass(variant, surfaceTheme),
        typo.headingSans,
        className,
      )}
      onClick={isCurrentPlan ? undefined : onClick}
    >
      {children}
    </MagneticButton>
  );
}
