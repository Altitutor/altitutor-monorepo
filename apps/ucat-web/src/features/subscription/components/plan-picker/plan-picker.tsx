"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { cn } from "@/lib/utils";
import { BillingIntervalSelector } from "./billing-interval-selector";
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

function PaidTierPriceBlock({
  pricing,
  formatMoney,
  billedAt,
  trialHint,
  dark = false,
}: {
  pricing: NonNullable<ReturnType<typeof usePlanPicker>["unlimitedPricing"]>;
  formatMoney: (cents: number) => string;
  billedAt: (cents: number) => string;
  trialHint: string;
  dark?: boolean;
}) {
  const muted = dark ? "text-marketing-cream/50" : "text-marketing-charcoal/50";
  const strike = dark ? "text-marketing-cream/40" : "text-marketing-charcoal/40";
  const body = dark ? "text-marketing-cream" : "text-marketing-charcoal";
  const accent = dark ? "text-marketing-accent" : "text-marketing-primary";

  return (
    <div className="mt-6 space-y-1">
      <p className={`text-sm line-through ${strike} ${typo.dataMono}`}>
        {formatMoney(pricing.penaltyWeeklyCents)}/wk penalty
      </p>
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold ${body} ${typo.headingSans}`}>
          {formatMoney(pricing.idealWeeklyCents)}
        </span>
        <span className={`mb-1 ${muted} ${typo.secondarySans}`}>/wk</span>
      </div>
      <p className={`text-xs ${muted} ${typo.secondarySans}`}>
        {billedAt(pricing.idealPeriodCents)} with daily practice discounts
      </p>
      <p className={`text-xs ${accent} ${typo.dataMono}`}>{trialHint}</p>
    </div>
  );
}

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
    billingInterval,
    setBillingInterval,
    freeIsCurrentPlan,
    isOnPaid,
    trialCta,
    trialHint,
    unlimitedPricing,
    proPricing,
    unlimitedAvailable,
    proAvailable,
    unlimitedTierOffered,
    proTierOffered,
    formatMoney,
    billedAt,
    onlineFeatures,
    proFeatures,
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
      <BillingIntervalSelector
        value={billingInterval}
        onChange={setBillingInterval}
        className="mb-10"
      />

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

          {isOnPaid ? null : (
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

        {/* UCAT Unlimited */}
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
              UCAT Unlimited
            </h3>
            <p
              className={`mt-3 text-sm text-marketing-charcoal/60 ${typo.secondarySans}`}
            >
              Unlimited online practice with accountability pricing — complete
              your daily targets to keep costs low.
            </p>

            {unlimitedPricing ? (
              <PaidTierPriceBlock
                pricing={unlimitedPricing}
                formatMoney={formatMoney}
                billedAt={billedAt}
                trialHint={trialHint}
              />
            ) : (
              <p
                className={`mt-6 text-sm text-marketing-charcoal/50 ${typo.secondarySans}`}
              >
                Coming soon
              </p>
            )}

            <p
              className={`mt-6 text-sm font-semibold text-marketing-charcoal/80 ${typo.secondarySans}`}
            >
              Everything in Free, plus
            </p>
            <ul
              className={`mt-3 space-y-2.5 text-sm text-marketing-charcoal/70 ${typo.secondarySans}`}
            >
              {onlineFeatures.map((f) => (
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
            disabled={loadingPlan !== null || !unlimitedAvailable}
            onClick={() => void handleOnlineSubscribe("unlimited")}
          >
            {!unlimitedTierOffered
              ? "Coming soon"
              : !unlimitedAvailable
                ? "Unavailable"
                : loadingPlan === "unlimited"
                  ? "Redirecting…"
                  : trialCta}
          </PlanPickerCta>
        </div>

        {/* UCAT Pro */}
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
              Best support
            </span>
          </div>
          <div className="absolute left-0 top-0 h-40 w-40 rounded-br-full bg-marketing-accent/10 blur-3xl" />

          <div>
            <span
              className={`text-xs font-bold uppercase tracking-widest text-marketing-accent ${typo.dataMono}`}
            >
              Online + tutors
            </span>
            <h3
              className={`mt-3 text-2xl font-bold text-marketing-cream ${typo.headingSans}`}
            >
              UCAT Pro
            </h3>
            <p
              className={`mt-3 text-sm text-marketing-cream/60 ${typo.secondarySans}`}
            >
              Everything in Unlimited, plus workshops, on-demand tutor help, and
              monthly 1-1 performance reviews.
            </p>

            {proPricing ? (
              <PaidTierPriceBlock
                pricing={proPricing}
                formatMoney={formatMoney}
                billedAt={billedAt}
                trialHint={trialHint}
                dark
              />
            ) : (
              <p
                className={`mt-6 text-sm text-marketing-cream/60 ${typo.secondarySans}`}
              >
                Coming soon
              </p>
            )}

            <p
              className={`mt-6 text-sm font-semibold text-marketing-cream/80 ${typo.secondarySans}`}
            >
              Everything in Unlimited, plus
            </p>
            <ul className={`mt-3 space-y-2.5 text-sm ${typo.secondarySans}`}>
              {proFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-marketing-accent"
                >
                  <PlanPickerCheckIcon />
                  <span className="text-marketing-cream/70">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <PlanPickerCta
            variant="monthlyFeatured"
            disabled={loadingPlan !== null || !proAvailable}
            onClick={() => void handleOnlineSubscribe("pro")}
          >
            {!proTierOffered
              ? "Coming soon"
              : !proAvailable
                ? "Unavailable"
                : loadingPlan === "pro"
                  ? "Redirecting…"
                  : trialCta}
          </PlanPickerCta>
        </div>
      </div>
    </div>
  );
}
