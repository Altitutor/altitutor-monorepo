"use client";
import { Button } from "@/components/ui/button";

import type { CardComponentProps } from "nextstepjs";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { UCAT_SURFACE_CARD } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

/**
 * Themed onboarding card used by `<NextStep cardComponent={...}>`.
 *
 * Sizing notes:
 * - Default width `min(20rem, calc(100vw - 2rem))` for full-width anchors.
 * - For `side: top/bottom` anchored to the **narrow sidebar nav rows**
 *   (~240px wide), nextstepjs centers the card horizontally on the row. A
 *   20rem (~320px) card then extends past the left viewport edge; we cap
 *   width (~14rem) so it stays on-screen. Detected via selector since some
 *   other steps also use the fixed viewport (e.g. the progress toolbar) but
 *   have a wide anchor and don't need narrowing.
 * - No max-height / internal scroll — vertical placement is handled in
 *   `tour-steps.tsx` (`top` / `bottom` vs `right` for sidebar steps).
 */
const SIDEBAR_NAV_SELECTOR_PATTERN = /^(#ucat-onboarding-welcome|\[data-tour='nav-)/;
export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  const progressPct = Math.round(((currentStep + 1) / totalSteps) * 100);

  const isSidebarTopOrBottom =
    !!step.selector &&
    SIDEBAR_NAV_SELECTOR_PATTERN.test(step.selector) &&
    (step.side === "top" || step.side === "bottom");

  return (
    <div
      className={cn(
        "relative rounded-ucatShell p-5 text-card-foreground shadow-xl",
        UCAT_SURFACE_CARD,
        isSidebarTopOrBottom
          ? "w-[min(14rem,calc(100vw-2rem))] max-w-none"
          : "w-[min(20rem,calc(100vw-2rem))] max-w-sm",
      )}
      role="dialog"
      aria-labelledby="ucat-onboarding-title"
    >
      {arrow}

      <div className="flex items-start gap-3">
        {step.icon ? (
          <span className="text-2xl leading-none" aria-hidden>
            {step.icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </p>
          <h3
            id="ucat-onboarding-title"
            className="mt-0.5 text-base font-semibold leading-snug"
          >
            {step.title}
          </h3>
        </div>
        {step.showSkip && skipTour ? (
          <button
            type="button"
            onClick={skipTour}
            aria-label="Skip tour"
            className={cn(
              "-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 text-sm leading-relaxed text-card-foreground/90">
        {step.content}
      </div>

      <div
        className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={currentStep + 1}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {step.showControls ? (
        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prevStep}
            disabled={isFirst}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Button type="button" size="sm" onClick={nextStep} className="gap-1">
            {isLast ? "Finish" : "Next"}
            {isLast ? null : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
