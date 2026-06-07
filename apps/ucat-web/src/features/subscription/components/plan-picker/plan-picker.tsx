"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { cn } from "@/lib/utils";
import { PlanPickerCheckIcon } from "./plan-picker-check-icon";
import { PlanPickerCta } from "./plan-picker-cta";
import { usePlanPicker } from "./use-plan-picker";

const { typography: typo } = MARKETING_TOKENS;

type PlanPickerProps = {
  variant?: "page" | "dialog";
  className?: string;
  onContinueFree?: () => void;
  onCheckoutStart?: () => void;
};

export function PlanPicker({
  variant = "page",
  className,
  onContinueFree,
  onCheckoutStart,
}: PlanPickerProps) {
  const picker = usePlanPicker({ onContinueFree, onCheckoutStart });
  const {
    cfg,
    error,
    loadingPlan,
    freeIsCurrentPlan,
    isOnPro,
    proTrialCta,
    proTrialHint,
    weeklyProPricing,
    monthlyProPricing,
    monthlySavingsPercent,
    formatMoney,
    onlineFeatures,
    freeQuotaAreas,
    formatFreeQuotaLine,
    handleFreePlanAction,
    handleOnlineSubscribe,
  } = picker;

  const gridClass =
    variant === "dialog"
      ? "grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3"
      : "grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3";

  const cardPadding = variant === "dialog" ? "p-6 md:p-7" : "p-8 md:p-10";

  return (
    <div className={className}>
      {error ? (
        <div
          className={`mx-auto mb-6 max-w-md rounded-2xl bg-red-500/10 p-4 text-center text-sm text-red-600 ${typo.secondarySans}`}
        >
          {error}
        </div>
      ) : null}

      <div className={gridClass}>
        {/* UCAT Free */}
        <div
          className={cn(
            "relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-white shadow-lg ring-1 transition-all duration-300",
            cardPadding,
            freeIsCurrentPlan
              ? "ring-2 ring-marketing-primary/30"
              : "ring-black/5 hover:shadow-xl",
          )}
        >
          <div>
            {freeIsCurrentPlan ? (
              <span
                className={`inline-block rounded-full bg-marketing-primary/10 px-3 py-1 text-xs font-semibold text-marketing-primary ${typo.dataMono}`}
              >
                Current plan
              </span>
            ) : null}
            <span
              className={`mt-2 block text-xs font-bold uppercase tracking-widest text-marketing-charcoal/50 ${typo.dataMono}`}
            >
              Free
            </span>
            <h3
              className={`mt-3 text-2xl font-bold text-marketing-charcoal ${typo.headingSans}`}
            >
              UCAT Free
            </h3>
            <p
              className={`mt-3 text-sm text-marketing-charcoal/60 ${typo.secondarySans}`}
            >
              Get started at no cost with limited access to every area of the
              platform.
            </p>

            <div className="mt-6 space-y-1">
              <div className="flex items-end gap-2">
                <span
                  className={`text-4xl font-bold text-marketing-charcoal ${typo.headingSans}`}
                >
                  $0
                </span>
                <span
                  className={`mb-1 text-marketing-charcoal/50 ${typo.secondarySans}`}
                >
                  forever
                </span>
              </div>
              <p className={`text-xs text-marketing-charcoal/50 ${typo.dataMono}`}>
                Quotas reset daily, weekly, or monthly
              </p>
            </div>

            <ul
              className={`mt-6 space-y-2.5 text-sm text-marketing-charcoal/70 ${typo.secondarySans}`}
            >
              {freeQuotaAreas.map((area) => {
                const quota = cfg.freeQuotas[area];
                return (
                  <li
                    key={area}
                    className="flex items-start gap-2 text-marketing-primary"
                  >
                    <PlanPickerCheckIcon />
                    <span className="text-marketing-charcoal/70">
                      {formatFreeQuotaLine(area, quota.limit, quota.period)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {isOnPro ? null : (
            <PlanPickerCta
              variant="free"
              disabled={loadingPlan !== null}
              onClick={() => void handleFreePlanAction()}
            >
              {freeIsCurrentPlan
                ? onContinueFree
                  ? "Close"
                  : "Back to dashboard"
                : loadingPlan === "free"
                  ? "Saving…"
                  : "Continue with Free"}
            </PlanPickerCta>
          )}
        </div>

        {/* Weekly Pro */}
        <div
          className={cn(
            "relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-white shadow-lg ring-1 ring-black/5 transition-all duration-300 hover:shadow-xl hover:ring-marketing-primary/20",
            cardPadding,
          )}
        >
          <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-marketing-primary/8 blur-2xl" />
          <div>
            <span
              className={`text-xs font-bold uppercase tracking-widest text-marketing-primary ${typo.dataMono}`}
            >
              Online
            </span>
            <h3
              className={`mt-3 text-2xl font-bold text-marketing-charcoal ${typo.headingSans}`}
            >
              UCAT Pro (weekly)
            </h3>
            <p
              className={`mt-3 text-sm text-marketing-charcoal/60 ${typo.secondarySans}`}
            >
              Complete your weekly practice and keep your cost low. Billed every
              week.
            </p>

            <div className="mt-6 space-y-1">
              <p
                className={`text-sm text-marketing-charcoal/40 line-through ${typo.dataMono}`}
              >
                {formatMoney(weeklyProPricing.penaltyWeeklyCents)}/wk penalty
              </p>
              <div className="flex items-end gap-2">
                <span
                  className={`text-4xl font-bold text-marketing-charcoal ${typo.headingSans}`}
                >
                  {formatMoney(weeklyProPricing.idealWeeklyCents)}
                </span>
                <span
                  className={`mb-1 text-marketing-charcoal/50 ${typo.secondarySans}`}
                >
                  /wk
                </span>
              </div>
              <p className={`text-xs text-marketing-charcoal/50 ${typo.secondarySans}`}>
                With daily practice discounts applied
              </p>
              <p className={`text-xs text-marketing-primary ${typo.dataMono}`}>
                {proTrialHint}
              </p>
            </div>

            <ul
              className={`mt-6 space-y-2.5 text-sm text-marketing-charcoal/70 ${typo.secondarySans}`}
            >
              {onlineFeatures.slice(0, 4).map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-marketing-primary"
                >
                  <PlanPickerCheckIcon />
                  <span className="text-marketing-charcoal/70">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <PlanPickerCta
            variant="proAccent"
            disabled={loadingPlan !== null || !cfg.weeklyPlanAvailable}
            onClick={() => void handleOnlineSubscribe("weekly")}
          >
            {!cfg.weeklyPlanAvailable
              ? "Unavailable"
              : loadingPlan === "weekly"
                ? "Redirecting…"
                : proTrialCta}
          </PlanPickerCta>
        </div>

        {/* Monthly Pro */}
        <div
          className={cn(
            "relative flex flex-col justify-between overflow-hidden rounded-[2.5rem] bg-marketing-primary shadow-2xl ring-2 ring-marketing-accent/40 transition-all duration-300 hover:ring-marketing-accent/70",
            cardPadding,
            variant === "page" ? "md:scale-[1.03]" : "",
          )}
        >
          <div className="absolute right-6 top-6">
            <span
              className={`rounded-full bg-marketing-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-marketing-charcoal ${typo.dataMono}`}
            >
              Best Value
            </span>
          </div>
          <div className="absolute left-0 top-0 h-40 w-40 rounded-br-full bg-marketing-accent/10 blur-3xl" />

          <div>
            <span
              className={`text-xs font-bold uppercase tracking-widest text-marketing-accent ${typo.dataMono}`}
            >
              Online
            </span>
            <h3
              className={`mt-3 text-2xl font-bold text-marketing-cream ${typo.headingSans}`}
            >
              UCAT Pro (monthly)
            </h3>
            <p
              className={`mt-3 text-sm text-marketing-cream/60 ${typo.secondarySans}`}
            >
              Commit monthly and save. Everything in weekly, billed once a
              month.
            </p>

            <div className="mt-6 space-y-1">
              <p
                className={`text-sm text-marketing-cream/40 line-through ${typo.dataMono}`}
              >
                {formatMoney(monthlyProPricing.penaltyWeeklyCents)}/wk · billed
                at {formatMoney(monthlyProPricing.penaltyPeriodCents)}/mo penalty
              </p>
              <div className="flex items-end gap-2">
                <span
                  className={`text-4xl font-bold text-marketing-cream ${typo.headingSans}`}
                >
                  {formatMoney(monthlyProPricing.idealWeeklyCents)}
                </span>
                <span
                  className={`mb-1 text-marketing-cream/50 ${typo.secondarySans}`}
                >
                  /wk
                </span>
              </div>
              <p className={`text-xs text-marketing-cream/60 ${typo.secondarySans}`}>
                Billed at {formatMoney(monthlyProPricing.idealPeriodCents)}/mo with
                daily practice discounts
              </p>
              <p className={`text-xs text-marketing-accent ${typo.dataMono}`}>
                {proTrialHint}
              </p>
            </div>

            <ul className={`mt-6 space-y-2.5 text-sm ${typo.secondarySans}`}>
              {onlineFeatures.slice(0, 4).map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-marketing-accent"
                >
                  <PlanPickerCheckIcon />
                  <span className="text-marketing-cream/70">{f}</span>
                </li>
              ))}
              {monthlySavingsPercent > 0 ? (
                <li className="flex items-start gap-2 text-marketing-accent">
                  <PlanPickerCheckIcon />
                  <span className="text-marketing-cream/70">
                    Save ~{monthlySavingsPercent}% vs weekly billing
                  </span>
                </li>
              ) : null}
            </ul>
          </div>

          <PlanPickerCta
            variant="monthlyFeatured"
            disabled={loadingPlan !== null || !cfg.monthlyPlanAvailable}
            onClick={() => void handleOnlineSubscribe("monthly")}
          >
            {!cfg.monthlyPlanAvailable
              ? "Unavailable"
              : loadingPlan === "monthly"
                ? "Redirecting…"
                : proTrialCta}
          </PlanPickerCta>
        </div>
      </div>
    </div>
  );
}
