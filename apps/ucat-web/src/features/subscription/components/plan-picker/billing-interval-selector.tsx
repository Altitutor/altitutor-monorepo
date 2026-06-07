"use client";

import type { UcatBillingInterval } from "@altitutor/shared";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { billingIntervalLabel } from "@/features/subscription/lib/marketing-plan-pricing";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex justify-center", className)}>
      <SegmentedControl
        value={value}
        onValueChange={onChange}
        options={INTERVALS.map((interval) => ({
          value: interval,
          label: billingIntervalLabel(interval),
        }))}
        className="text-sm sm:text-base [&_button]:!px-5 [&_button]:!py-2.5 sm:[&_button]:!px-8 sm:[&_button]:!py-3"
      />
    </div>
  );
}
