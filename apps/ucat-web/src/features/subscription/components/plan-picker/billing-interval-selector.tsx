"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import type { UcatBillingInterval } from "@altitutor/shared";
import { cn } from "@/lib/utils";
import { billingIntervalLabel } from "@/features/subscription/lib/marketing-plan-pricing";

const { typography: typo } = MARKETING_TOKENS;

const INTERVALS: UcatBillingInterval[] = ["week", "month", "year"];

type BillingIntervalSelectorProps = {
  value: UcatBillingInterval;
  onChange: (interval: UcatBillingInterval) => void;
  className?: string;
};

export function BillingIntervalSelector({
  value,
  onChange,
  className,
}: BillingIntervalSelectorProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md rounded-full bg-white p-1 shadow-md ring-1 ring-black/5",
        className,
      )}
      role="tablist"
      aria-label="Billing interval"
    >
      {INTERVALS.map((interval) => {
        const selected = value === interval;
        return (
          <button
            key={interval}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              `flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${typo.secondarySans}`,
              selected
                ? "bg-marketing-primary text-white shadow-sm"
                : "text-marketing-charcoal/60 hover:text-marketing-charcoal",
            )}
            onClick={() => onChange(interval)}
          >
            {billingIntervalLabel(interval)}
          </button>
        );
      })}
    </div>
  );
}
