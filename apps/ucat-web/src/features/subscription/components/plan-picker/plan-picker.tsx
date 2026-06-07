"use client";

import { MARKETING_TOKENS } from "@altitutor/shared";
import { cn } from "@/lib/utils";
import { BillingIntervalSelector } from "./billing-interval-selector";
import { PaidTierPriceBlock } from "./paid-tier-price-block";
import { PlanPickerCheckIcon } from "./plan-picker-check-icon";
import { PlanPickerCta } from "./plan-picker-cta";
import { usePlanPicker } from "./use-plan-picker";

const { typography: typo } = MARKETING_TOKENS;

type PlanPickerProps = {
  variant?: "page" | "dialog" | "onboarding";
  className?: string;
  onContinueFree?: () => void;
  onCheckoutStart?: () => void;
  /** Light selector for cream marketing backgrounds */
  selectorTheme?: "app" | "light";
  /** Landing page: CTAs route to signup */
  audience?: "app" | "marketing";
  checkoutReturnContext?: "signup_onboarding" | "subscribe";
};

function TrialBadge({
  trialDays,
  dark = false,
}: {
  trialDays: number;
  dark?: boolean;
}) {
  if (trialDays <= 0) return null;
  return (
    <span
      className={cn(
        `rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${typo.dataMono}`,
        dark
          ? "bg-marketing-accent text-marketing-charcoal"
          : "bg-marketing-primary/10 text-marketing-primary",
      )}
    >
      {trialDays}-day free trial
    </span>
  );
}

function paidCtaLabel(
  tierOffered: boolean,
  available: boolean,
  loading: boolean,
  trialCta: string,
): string {
  if (!tierOffered || !available) return "Coming soon";
  if (loading) return "Redirecting…";
  return trialCta;
}

export function PlanPicker({
  variant = "page",
  className,
  onContinueFree,
  onCheckoutStart,
  selectorTheme = "app",
  audience = "app",
  checkoutReturnContext = "subscribe",
}: PlanPickerProps) {
  const picker = usePlanPicker({
    onContinueFree,
    onCheckoutStart,
    audience,
    checkoutReturnContext,
  });
  const {
    cfg,
    error,
    loadingPlan,
    billingInterval,
    setBillingInterval,
    freeIsCurrentPlan,
    isOnPaid,
    trialCta,
    unlimitedPricing,
    proPricing,
    unlimitedAvailable,
    proAvailable,
    unlimitedTierOffered,
    proTierOffered,
    practiceDiscount,
    formatMoney,
    onlineFeatures,
    proFeatures,
    freeQuotaAreas,
    formatFreeQuotaLine,
    handleFreePlanAction,
    handleOnlineSubscribe,
  } = picker;

  const discountRule = practiceDiscount ?? {
    discountPerDayCents: 0,
    maxDiscountsPerPeriod: 0,
  };

  const gridClass =
    variant === "dialog" || variant === "onboarding"
      ? "grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3"
      : "grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3";

  const cardPadding =
    variant === "dialog" || variant === "onboarding"
      ? "p-6 md:p-7"
      : "p-8 md:p-10";

  return (
    <div className={className}>
      <BillingIntervalSelector
        value={billingInterval}
        onChange={setBillingInterval}
        theme={selectorTheme}
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
                  free forever
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

          {isOnPaid && audience === "app" ? null : (
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
                  : audience === "marketing"
                    ? "Sign up free"
                    : checkoutReturnContext === "signup_onboarding"
                      ? "Continue with Free"
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
          {cfg.trialDays > 0 ? (
            <div className="absolute right-6 top-6">
              <TrialBadge trialDays={cfg.trialDays} />
            </div>
          ) : null}
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
                billingInterval={billingInterval}
                minQuestionsPerDay={cfg.minQuestionsPerDay}
                discountPerDayCents={discountRule.discountPerDayCents}
                maxDiscountsPerPeriod={discountRule.maxDiscountsPerPeriod}
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
            disabled={
              loadingPlan !== null || !unlimitedTierOffered || !unlimitedAvailable
            }
            onClick={() => void handleOnlineSubscribe("unlimited")}
          >
            {paidCtaLabel(
              unlimitedTierOffered,
              unlimitedAvailable,
              loadingPlan === "unlimited",
              audience === "marketing" ? "Sign up" : trialCta,
            )}
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
          <div className="absolute right-6 top-6 flex flex-col items-end gap-2">
            {cfg.trialDays > 0 ? (
              <TrialBadge trialDays={cfg.trialDays} dark />
            ) : null}
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
                billingInterval={billingInterval}
                minQuestionsPerDay={cfg.minQuestionsPerDay}
                discountPerDayCents={discountRule.discountPerDayCents}
                maxDiscountsPerPeriod={discountRule.maxDiscountsPerPeriod}
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
            disabled={loadingPlan !== null || !proTierOffered || !proAvailable}
            onClick={() => void handleOnlineSubscribe("pro")}
          >
            {paidCtaLabel(
              proTierOffered,
              proAvailable,
              loadingPlan === "pro",
              audience === "marketing" ? "Sign up" : trialCta,
            )}
          </PlanPickerCta>
        </div>
      </div>
    </div>
  );
}
