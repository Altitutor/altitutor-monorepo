"use client";

import { Info } from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import type { UcatBillingInterval } from "@altitutor/shared";
import { maxPracticeDayDiscountCents } from "@altitutor/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import {
  billingIntervalLabel,
  billingIntervalShort,
} from "@/features/subscription/lib/marketing-plan-pricing";
import type { usePlanPicker } from "./use-plan-picker";

const { typography: typo } = MARKETING_TOKENS;

type PaidTierPriceBlockProps = {
  pricing: NonNullable<ReturnType<typeof usePlanPicker>["unlimitedPricing"]>;
  formatMoney: (cents: number) => string;
  billingInterval: UcatBillingInterval;
  minQuestionsPerDay: number;
  discountPerDayCents: number;
  maxDiscountsPerPeriod: number;
  dark?: boolean;
};

export function PaidTierPriceBlock({
  pricing,
  formatMoney,
  billingInterval,
  minQuestionsPerDay,
  discountPerDayCents,
  maxDiscountsPerPeriod,
  dark = false,
}: PaidTierPriceBlockProps) {
  const muted = dark ? "text-marketing-cream/50" : "text-marketing-charcoal/50";
  const body = dark ? "text-marketing-cream" : "text-marketing-charcoal";
  const accent = dark ? "text-marketing-accent" : "text-marketing-primary";
  const intervalShort = billingIntervalShort(billingInterval);
  const intervalLabel = billingIntervalLabel(billingInterval).toLowerCase();
  const maxDiscountCents = maxPracticeDayDiscountCents(
    discountPerDayCents,
    maxDiscountsPerPeriod,
  );
  const isWeekly = billingInterval === "week";

  const penaltyLine = isWeekly ? (
    <>
      <span className={body}>{formatMoney(pricing.penaltyWeeklyCents)}</span>
      {" / week without daily practice discounts"}
    </>
  ) : (
    <>
      <span className={body}>{formatMoney(pricing.penaltyWeeklyCents)}</span>
      {" / week without daily practice discounts, billed at "}
      <span className={body}>{formatMoney(pricing.penaltyPeriodCents)}</span>
      {" / "}
      {intervalShort}
    </>
  );

  return (
    <div className="mt-6 space-y-2">
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className={`text-4xl font-bold ${body} ${typo.headingSans}`}>
          {formatMoney(pricing.idealWeeklyCents)}
        </span>
        <span className={`mb-1 ${muted} ${typo.secondarySans}`}>/ week</span>
        <span className={`mb-1 flex items-center gap-1 text-sm ${muted} ${typo.secondarySans}`}>
          with daily practice discounts
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`inline-flex rounded-full p-0.5 ${accent} hover:opacity-80`}
                  aria-label="How practice discounts work"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-sm">
                Earn {formatMoney(discountPerDayCents)} off your next bill when you
                do at least {minQuestionsPerDay} questions per day, up to a maximum
                of {formatMoney(maxDiscountCents)} per {intervalLabel} billing
                period.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
      </div>

      <p className={`text-sm ${muted} ${typo.secondarySans}`}>{penaltyLine}</p>
    </div>
  );
}
