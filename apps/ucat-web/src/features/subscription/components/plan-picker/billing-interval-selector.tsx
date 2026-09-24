"use client";

import type { UcatBillingInterval } from "@altitutor/shared";
import { billingIntervalLabel } from "@/features/subscription/lib/marketing-plan-pricing";
import { cn } from "@/lib/utils";

const INTERVALS: UcatBillingInterval[] = ["week", "month", "year"];

type BillingIntervalSelectorProps = {
  value: UcatBillingInterval;
  onChange: (interval: UcatBillingInterval) => void;
  className?: string;
  /** Light marketing surfaces (cream background) — fixed colors regardless of OS dark mode */
  theme?: "app" | "light";
  intervals?: UcatBillingInterval[];
};

export function BillingIntervalSelector({
  value,
  onChange,
  className,
  theme = "app",
  intervals = INTERVALS,
}: BillingIntervalSelectorProps) {
  return (
    <div className={cn("flex justify-center", className)}>
      <div
        role="tablist"
        aria-label="Billing interval"
        className={cn(
          "inline-grid max-w-full grid-flow-col overflow-x-auto rounded-[var(--radius)] p-0.5 text-sm ring-1 sm:text-base",
          theme === "light"
            ? "bg-neutral-200/80 ring-black/10"
            : "bg-muted/90 ring-black/[0.06] dark:ring-white/10",
        )}
      >
        {intervals.map((interval) => {
          const active = interval === value;
          return (
            <button
              key={interval}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(interval)}
              className={cn(
                "min-w-[6.25rem] whitespace-nowrap rounded-[calc(var(--radius)_-_0.125rem)] px-5 py-2.5 font-medium transition-colors sm:px-8 sm:py-3",
                theme === "light"
                  ? active
                    ? "bg-white text-black shadow-sm ring-1 ring-black/10"
                    : "text-black/60 hover:bg-black/5"
                  : active
                    ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.05] dark:ring-white/[0.07]"
                    : "text-foreground hover:bg-muted/80",
              )}
            >
              {billingIntervalLabel(interval)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
