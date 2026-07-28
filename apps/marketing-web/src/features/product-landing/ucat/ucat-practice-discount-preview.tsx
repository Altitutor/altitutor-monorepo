"use client";

import { Check, Flame } from "lucide-react";
import { MARKETING_TOKENS } from "@altitutor/shared";

const { typography: typo } = MARKETING_TOKENS;

const PERIOD_SAVED = "$21";

const WEEK_DAYS = [
  { label: "Mon", practiced: true, isToday: false },
  { label: "Tue", practiced: true, isToday: false },
  { label: "Wed", practiced: true, isToday: false },
  { label: "Thu", practiced: false, isToday: true },
] as const;

export function UcatPracticeDiscountPreview() {
  return (
    <div className="ucat-product-ui w-full min-w-0" aria-hidden>
      <p
        className={`mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums tracking-tight text-marketing-charcoal ${typo.headingSans}`}
      >
        <Flame className="size-5 fill-amber-400 text-amber-500" aria-hidden />
        3 days
      </p>

      <div
        className="mt-4 grid grid-cols-4 gap-2"
        aria-label="Practice days this week"
      >
        {WEEK_DAYS.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-1">
            <span
              className={`flex size-7 items-center justify-center rounded-full border text-[10px] font-semibold sm:size-8 sm:text-xs ${
                day.practiced
                  ? "border-amber-400 bg-amber-400 text-amber-950 shadow-[0_3px_12px_rgba(251,191,36,0.24)]"
                  : day.isToday
                    ? "border-dashed border-amber-500/70 bg-amber-500/[0.06] text-amber-700"
                    : "border-black/[0.08] bg-white/60 text-marketing-charcoal/45"
              }`}
            >
              {day.practiced ? (
                <Check className="size-3 sm:size-4" aria-hidden />
              ) : null}
            </span>
            <span
              className={`text-[10px] font-medium ${typo.secondarySans} ${
                day.isToday
                  ? "text-marketing-charcoal"
                  : "text-marketing-charcoal/45"
              }`}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>

      <p
        className={`mt-5 text-sm text-marketing-charcoal/55 ${typo.secondarySans}`}
      >
        {PERIOD_SAVED} saved this month
      </p>
    </div>
  );
}
