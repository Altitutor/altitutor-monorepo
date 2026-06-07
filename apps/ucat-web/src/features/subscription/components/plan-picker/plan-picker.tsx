"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { cn } from "@/lib/utils";
import { BillingIntervalSelector } from "./billing-interval-selector";
import { PaidTierPriceBlock } from "./paid-tier-price-block";
import { PlanPickerCheckIcon } from "./plan-picker-check-icon";
import { PlanPickerCta } from "./plan-picker-cta";
import {
  planPickerCardMotionProps,
} from "./plan-picker-dialog-shell";
import {
  planPickerSurface,
  type PlanPickerSurfaceTheme,
} from "./plan-picker-surface-theme";
import { usePlanPicker } from "./use-plan-picker";

const { typography: typo } = MARKETING_TOKENS;

type PlanPickerProps = {
  variant?: "page" | "dialog" | "onboarding";
  className?: string;
  onContinueFree?: () => void;
  onCheckoutStart?: () => void;
  /** Light selector for cream marketing backgrounds */
  selectorTheme?: "app" | "light";
  /** App surfaces follow theme tokens (dark mode); marketing uses fixed cream/charcoal */
  surfaceTheme?: PlanPickerSurfaceTheme;
  /** Landing page: CTAs route to signup */
  audience?: "app" | "marketing";
  checkoutReturnContext?: "signup_onboarding" | "subscribe";
};

function TrialBadge({
  trialDays,
  featured = false,
  surfaceTheme = "marketing",
}: {
  trialDays: number;
  featured?: boolean;
  surfaceTheme?: PlanPickerSurfaceTheme;
}) {
  if (trialDays <= 0) return null;
  const surface = planPickerSurface(surfaceTheme);
  return (
    <span
      className={cn(
        `rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${typo.dataMono}`,
        featured
          ? "bg-marketing-accent text-marketing-charcoal"
          : surface.trialBadge,
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

function PlanPickerCard({
  animate,
  className,
  children,
}: {
  animate: boolean;
  className: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const card = (
    <div className={className}>{children}</div>
  );

  if (!animate) return card;

  return (
    <motion.div
      className="h-full"
      variants={planPickerCardMotionProps(reduceMotion ?? false).variants}
    >
      {card}
    </motion.div>
  );
}

export function PlanPicker({
  variant = "page",
  className,
  onContinueFree,
  onCheckoutStart,
  selectorTheme,
  surfaceTheme = "marketing",
  audience = "app",
  checkoutReturnContext = "subscribe",
}: PlanPickerProps) {
  const reduceMotion = useReducedMotion();
  const surface = planPickerSurface(surfaceTheme);
  const resolvedSelectorTheme =
    selectorTheme ?? (surfaceTheme === "marketing" ? "light" : "app");
  const animateCards = variant === "dialog";

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
    isOnUnlimited,
    isOnPro,
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

  const unlimitedIsCurrentPlan = isOnUnlimited && !isOnPro;

  const cardGridVariants = useMemo(
    () => ({
      hidden: {},
      show: {
        transition: {
          staggerChildren: (reduceMotion ?? false) ? 0 : 0.07,
          delayChildren: (reduceMotion ?? false) ? 0 : 0.05,
        },
      },
    }),
    [reduceMotion],
  );

  const Grid = animateCards ? motion.div : "div";
  const gridMotionProps = animateCards
    ? {
        variants: cardGridVariants,
        initial: (reduceMotion ?? false) ? false : ("hidden" as const),
        animate: "show" as const,
      }
    : {};

  return (
    <div className={className}>
      <BillingIntervalSelector
        value={billingInterval}
        onChange={setBillingInterval}
        theme={resolvedSelectorTheme}
        className="mb-10"
      />

      {error ? (
        <div
          className={cn(
            "mx-auto mb-6 max-w-md rounded-2xl p-4 text-center text-sm",
            surface.error,
            typo.secondarySans,
          )}
        >
          {error}
        </div>
      ) : null}

      <Grid className={gridClass} {...gridMotionProps}>
        {/* UCAT Free */}
        <PlanPickerCard
          animate={animateCards}
          className={cn(
            "relative flex h-full flex-col justify-between overflow-hidden rounded-[2.5rem] ring-1 transition-all duration-300",
            cardPadding,
            surface.freeCard,
            freeIsCurrentPlan
              ? "ring-2 ring-primary/30"
              : surface.freeCardRing,
          )}
        >
          <div>
            {freeIsCurrentPlan ? (
              <span
                className={cn(
                  `inline-block rounded-full px-3 py-1 text-xs font-semibold ${typo.dataMono}`,
                  surface.currentPlanBadge,
                )}
              >
                Current plan
              </span>
            ) : null}
            <span
              className={cn(
                `mt-2 block text-xs font-bold uppercase tracking-widest ${typo.dataMono}`,
                surface.tierLabelMuted,
              )}
            >
              Free
            </span>
            <h3
              className={cn(
                `mt-3 text-2xl font-bold ${typo.headingSans}`,
                surface.heading,
              )}
            >
              UCAT Free
            </h3>
            <p
              className={cn(
                `mt-3 text-sm ${typo.secondarySans}`,
                surface.description,
              )}
            >
              Get started at no cost with limited access to every area of the
              platform.
            </p>

            <div className="mt-6 space-y-1">
              <div className="flex items-end gap-2">
                <span
                  className={cn(
                    `text-4xl font-bold ${typo.headingSans}`,
                    surface.price,
                  )}
                >
                  $0
                </span>
                <span
                  className={cn(
                    `mb-1 ${typo.secondarySans}`,
                    surface.priceMuted,
                  )}
                >
                  free forever
                </span>
              </div>
              <p className={cn(`text-xs ${typo.dataMono}`, surface.priceCaption)}>
                Quotas reset daily, weekly, or monthly
              </p>
            </div>

            <ul className={`mt-6 space-y-2.5 text-sm ${typo.secondarySans}`}>
              {freeQuotaAreas.map((area) => {
                const quota = cfg.freeQuotas[area];
                return (
                  <li
                    key={area}
                    className={cn("flex items-start gap-2", surface.featureItem)}
                  >
                    <PlanPickerCheckIcon />
                    <span className={surface.featureText}>
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
              surfaceTheme={surfaceTheme}
              isCurrentPlan={freeIsCurrentPlan}
              disabled={loadingPlan !== null}
              onClick={() => void handleFreePlanAction()}
            >
              {freeIsCurrentPlan
                ? "Your current plan"
                : loadingPlan === "free"
                  ? "Saving…"
                  : audience === "marketing"
                    ? "Sign up free"
                    : checkoutReturnContext === "signup_onboarding"
                      ? "Continue with Free"
                      : "Continue with Free"}
            </PlanPickerCta>
          )}
        </PlanPickerCard>

        {/* UCAT Unlimited */}
        <PlanPickerCard
          animate={animateCards}
          className={cn(
            "relative flex h-full flex-col justify-between overflow-hidden rounded-[2.5rem] ring-1 transition-all duration-300",
            cardPadding,
            surface.unlimitedCard,
          )}
        >
          {cfg.trialDays > 0 ? (
            <div className="absolute right-6 top-6">
              <TrialBadge
                trialDays={cfg.trialDays}
                surfaceTheme={surfaceTheme}
              />
            </div>
          ) : null}
          <div
            className={cn(
              "absolute right-0 top-0 h-28 w-28 rounded-bl-full blur-2xl",
              surface.unlimitedGlow,
            )}
          />
          <div>
            <span
              className={cn(
                `text-xs font-bold uppercase tracking-widest ${typo.dataMono}`,
                surface.tierLabelAccent,
              )}
            >
              Online
            </span>
            <h3
              className={cn(
                `mt-3 text-2xl font-bold ${typo.headingSans}`,
                surface.heading,
              )}
            >
              UCAT Unlimited
            </h3>
            <p
              className={cn(
                `mt-3 text-sm ${typo.secondarySans}`,
                surface.description,
              )}
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
                surfaceTheme={surfaceTheme}
              />
            ) : (
              <p
                className={cn(
                  `mt-6 text-sm ${typo.secondarySans}`,
                  surface.comingSoon,
                )}
              >
                Coming soon
              </p>
            )}

            <p
              className={cn(
                `mt-6 text-sm font-semibold ${typo.secondarySans}`,
                surface.featureHeader,
              )}
            >
              Everything in Free, plus
            </p>
            <ul className={`mt-3 space-y-2.5 text-sm ${typo.secondarySans}`}>
              {onlineFeatures.map((f) => (
                <li
                  key={f}
                  className={cn("flex items-start gap-2", surface.featureItem)}
                >
                  <PlanPickerCheckIcon />
                  <span className={surface.featureText}>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <PlanPickerCta
            variant="proAccent"
            surfaceTheme={surfaceTheme}
            isCurrentPlan={unlimitedIsCurrentPlan}
            disabled={
              loadingPlan !== null || !unlimitedTierOffered || !unlimitedAvailable
            }
            onClick={() => void handleOnlineSubscribe("unlimited")}
          >
            {unlimitedIsCurrentPlan
              ? "Your current plan"
              : paidCtaLabel(
                  unlimitedTierOffered,
                  unlimitedAvailable,
                  loadingPlan === "unlimited",
                  audience === "marketing" ? "Sign up" : trialCta,
                )}
          </PlanPickerCta>
        </PlanPickerCard>

        {/* UCAT Pro */}
        <PlanPickerCard
          animate={animateCards}
          className={cn(
            "relative flex h-full flex-col justify-between overflow-hidden rounded-[2.5rem] bg-marketing-primary shadow-2xl ring-2 ring-marketing-accent/40 transition-all duration-300 hover:ring-marketing-accent/70",
            cardPadding,
            variant === "page" ? "md:scale-[1.03]" : "",
          )}
        >
          <div className="absolute right-6 top-6 flex flex-col items-end gap-2">
            {cfg.trialDays > 0 ? (
              <TrialBadge trialDays={cfg.trialDays} featured />
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
                featured
                surfaceTheme={surfaceTheme}
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
            surfaceTheme={surfaceTheme}
            isCurrentPlan={isOnPro}
            disabled={loadingPlan !== null || !proTierOffered || !proAvailable}
            onClick={() => void handleOnlineSubscribe("pro")}
          >
            {isOnPro
              ? "Your current plan"
              : paidCtaLabel(
                  proTierOffered,
                  proAvailable,
                  loadingPlan === "pro",
                  audience === "marketing" ? "Sign up" : trialCta,
                )}
          </PlanPickerCta>
        </PlanPickerCard>
      </Grid>
    </div>
  );
}
