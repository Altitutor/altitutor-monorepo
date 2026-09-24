"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { Skeleton } from "@altitutor/ui";
import { cn } from "@/lib/utils";
import { BillingIntervalSelector } from "./billing-interval-selector";
import { PaidTierPriceBlock } from "./paid-tier-price-block";
import { PlanPickerCheckIcon } from "./plan-picker-check-icon";
import { PlanPickerCta } from "./plan-picker-cta";
import { PlanPickerPriceSkeleton } from "./plan-picker-price-skeleton";
import { PlanCancellationDialog } from "./plan-cancellation-dialog";
import { ScheduledPlanDowngradeNotice } from "../scheduled-plan-downgrade-notice";
import { planPickerCardMotionProps } from "./plan-picker-dialog-shell";
import {
  planPickerSurface,
  type PlanPickerSurfaceTheme,
} from "./plan-picker-surface-theme";
import type { PlanPickerTier } from "@/features/subscription/lib/plan-tier-rank";
import { usePlanPicker } from "./use-plan-picker";

const { typography: typo } = MARKETING_TOKENS;

const ALL_PLAN_PICKER_TIERS: PlanPickerTier[] = ["free", "unlimited"];

type PlanPickerProps = {
  variant?: "page" | "dialog" | "onboarding";
  className?: string;
  onContinueFree?: () => void;
  onContinueCurrentPlan?: () => void;
  onCheckoutStart?: () => void;
  onDowngradeNavigate?: () => void;
  /** Light selector for cream marketing backgrounds */
  selectorTheme?: "app" | "light";
  /** App surfaces follow theme tokens (dark mode); marketing uses fixed cream/charcoal */
  surfaceTheme?: PlanPickerSurfaceTheme;
  /** Landing page: CTAs route to signup */
  audience?: "app" | "marketing";
  checkoutReturnContext?:
    | "signup_onboarding"
    | "subscribe"
    | "practice_session";
  /** Destination resumed after signup onboarding and any paid checkout. */
  postCheckoutReturnTo?: string;
  /** Subset of tiers to render (e.g. upgrade upsell on plan page) */
  visibleTiers?: PlanPickerTier[];
  layout?: "default" | "horizontal";
};

function paidCtaLabel(
  tierOffered: boolean,
  available: boolean,
  loading: boolean,
  paidCta: string,
): string {
  if (!tierOffered || !available) return "Coming soon";
  if (loading) return "Redirecting…";
  return paidCta;
}

function PlanPickerCard({
  animate,
  className,
  layoutClassName,
  children,
}: {
  animate: boolean;
  className: string;
  layoutClassName?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const card = <div className={className}>{children}</div>;

  if (!animate) {
    return layoutClassName ? (
      <div className={layoutClassName}>{card}</div>
    ) : (
      card
    );
  }

  return (
    <motion.div
      className={cn("h-full", layoutClassName)}
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
  onContinueCurrentPlan,
  onCheckoutStart,
  onDowngradeNavigate,
  selectorTheme,
  surfaceTheme = "marketing",
  audience = "app",
  checkoutReturnContext = "subscribe",
  postCheckoutReturnTo,
  visibleTiers,
  layout = "default",
}: PlanPickerProps) {
  const reduceMotion = useReducedMotion();
  const surface = planPickerSurface(surfaceTheme);
  const resolvedSelectorTheme =
    selectorTheme ?? (surfaceTheme === "marketing" ? "light" : "app");
  const animateCards = variant === "dialog";

  const picker = usePlanPicker({
    onContinueFree,
    onContinueCurrentPlan,
    onCheckoutStart,
    onDowngradeNavigate,
    audience,
    checkoutReturnContext,
    postCheckoutReturnTo,
  });
  const {
    cfg,
    error,
    loadingPlan,
    billingInterval,
    setBillingInterval,
    availableBillingIntervals,
    showBillingIntervalSelector,
    isPricingLoading,
    freeIsCurrentPlan,
    needsOnboarding,
    isOnPaid,
    isOnUnlimited,
    isDowngradeScheduled,
    scheduledDowngradeEndDate,
    paidCta,
    unlimitedPricing,
    unlimitedAvailable,
    unlimitedTierOffered,
    practiceDiscount,
    formatMoney,
    onlineFeatures,
    freeQuotaAreas,
    formatFreeQuotaLine,
    handleFreePlanAction,
    handleContinueCurrentPlan,
    handleKeepUnlimited,
    handleOnlineSubscribe,
    canDowngradeTo,
    handleDowngrade,
    cancellationOpen,
    downgradeTarget,
    handleCancellationOpenChange,
    cancellationReason,
    setCancellationReason,
    cancellationComment,
    setCancellationComment,
    cancellationConfirming,
    cancellationError,
    confirmDowngrade,
    cancellationBenefitsLost,
    cancellationEarnedDiscountCents,
    cancellationEarnedDiscountCurrency,
    cancellationPaidAccessEndsAt,
    cancellationCurrentPlanName,
    omitAudPrefix,
  } = picker;

  const tiersToShow = visibleTiers ?? ALL_PLAN_PICKER_TIERS;
  const showFree = tiersToShow.includes("free");
  const showUnlimited = tiersToShow.includes("unlimited");
  const isHorizontal = layout === "horizontal";
  const cardLayoutClass = isHorizontal ? "min-w-0 flex-1" : undefined;

  const discountRule = practiceDiscount ?? {
    discountPerDayCents: 0,
    maxDiscountsPerPeriod: 0,
  };

  const gridClass = isHorizontal
    ? "flex flex-col items-stretch gap-4 sm:flex-row"
    : variant === "dialog" || variant === "onboarding"
      ? cn(
          "grid grid-cols-1 items-stretch gap-4",
          tiersToShow.length === 2
            ? "mx-auto w-full max-w-5xl lg:grid-cols-2"
            : "lg:grid-cols-3",
        )
      : "mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 md:grid-cols-2";

  const cardPadding =
    isHorizontal || variant === "dialog" || variant === "onboarding"
      ? "p-6 md:p-7"
      : "p-8 md:p-10";

  const intervalSelectorClass = isHorizontal ? "mb-6" : "mb-10";

  const unlimitedIsCurrentPlan = isOnUnlimited;
  const freeIsDowngrade =
    audience === "app" && canDowngradeTo("free") && !freeIsCurrentPlan;
  const unlimitedIsDowngrade =
    audience === "app" &&
    canDowngradeTo("unlimited") &&
    !unlimitedIsCurrentPlan;
  const showFreeCta =
    showFree && (freeIsDowngrade || !(isOnPaid && audience === "app"));
  const currentPaidPlanActionable =
    isDowngradeScheduled || (Boolean(onContinueCurrentPlan) && needsOnboarding);

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
      {isDowngradeScheduled && scheduledDowngradeEndDate ? (
        <div className="mb-6">
          <ScheduledPlanDowngradeNotice endDate={scheduledDowngradeEndDate} />
        </div>
      ) : null}

      {showBillingIntervalSelector ? (
        <BillingIntervalSelector
          value={billingInterval}
          onChange={setBillingInterval}
          intervals={availableBillingIntervals}
          theme={resolvedSelectorTheme}
          className={intervalSelectorClass}
        />
      ) : null}

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
        {showFree ? (
          <PlanPickerCard
            animate={animateCards}
            layoutClassName={cardLayoutClass}
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
                <p
                  className={cn(
                    `text-xs ${typo.dataMono}`,
                    surface.priceCaption,
                  )}
                >
                  Quotas reset daily, weekly, or monthly
                </p>
              </div>

              {isPricingLoading ? (
                <ul className="mt-6 space-y-2.5" aria-hidden>
                  {freeQuotaAreas.map((area) => (
                    <li key={area}>
                      <Skeleton className="h-5 w-full max-w-[16rem] rounded-md" />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul
                  className={`mt-6 space-y-2.5 text-sm ${typo.secondarySans}`}
                >
                  {freeQuotaAreas.map((area) => {
                    const quota = cfg.freeQuotas[area];
                    return (
                      <li
                        key={area}
                        className={cn(
                          "flex items-start gap-2",
                          surface.featureItem,
                        )}
                      >
                        <PlanPickerCheckIcon />
                        <span className={surface.featureText}>
                          {formatFreeQuotaLine(area, quota.limit, quota.period)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {showFreeCta ? (
              <PlanPickerCta
                variant="free"
                surfaceTheme={surfaceTheme}
                isCurrentPlan={freeIsCurrentPlan}
                isDowngrade={freeIsDowngrade}
                disabled={!freeIsDowngrade && loadingPlan !== null}
                onClick={() =>
                  void (freeIsDowngrade
                    ? handleDowngrade("free")
                    : handleFreePlanAction())
                }
              >
                {freeIsCurrentPlan
                  ? "Your current plan"
                  : freeIsDowngrade
                    ? "Downgrade"
                    : loadingPlan === "free"
                      ? "Saving…"
                      : audience === "marketing"
                        ? "Sign up free"
                        : "Continue with Free"}
              </PlanPickerCta>
            ) : null}
          </PlanPickerCard>
        ) : null}

        {/* UCAT Unlimited */}
        {showUnlimited ? (
          <PlanPickerCard
            animate={animateCards}
            layoutClassName={cardLayoutClass}
            className={cn(
              "relative flex h-full flex-col justify-between overflow-hidden rounded-[2.5rem] ring-1 transition-all duration-300",
              cardPadding,
              surface.unlimitedCard,
            )}
          >
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
              {cfg.trialDays > 0 && !isOnPaid ? (
                <p
                  className={cn(
                    `mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${typo.secondarySans}`,
                    surface.trialBadge,
                  )}
                >
                  {cfg.trialDays}-day UCAT Unlimited trial for eligible new
                  students
                </p>
              ) : null}

              {isPricingLoading ? (
                <PlanPickerPriceSkeleton />
              ) : unlimitedPricing ? (
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
                    className={cn(
                      "flex items-start gap-2",
                      surface.featureItem,
                    )}
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
              isCurrentPlan={
                unlimitedIsCurrentPlan && !isDowngradeScheduled
              }
              currentPlanActionable={currentPaidPlanActionable}
              isDowngrade={unlimitedIsDowngrade}
              disabled={
                !unlimitedIsDowngrade &&
                (isPricingLoading ||
                  loadingPlan !== null ||
                  (!unlimitedIsCurrentPlan &&
                    (!unlimitedTierOffered || !unlimitedAvailable)))
              }
              onClick={() =>
                void (unlimitedIsDowngrade
                  ? handleDowngrade("unlimited")
                  : unlimitedIsCurrentPlan
                    ? isDowngradeScheduled
                      ? handleKeepUnlimited()
                      : handleContinueCurrentPlan()
                    : handleOnlineSubscribe("unlimited"))
              }
            >
              {unlimitedIsCurrentPlan
                ? isDowngradeScheduled
                  ? loadingPlan === "unlimited"
                    ? "Keeping…"
                    : "Keep UCAT Unlimited"
                  : currentPaidPlanActionable
                    ? "Continue with Unlimited"
                    : "Your current plan"
                : unlimitedIsDowngrade
                  ? "Downgrade"
                  : isPricingLoading
                    ? "Loading…"
                    : paidCtaLabel(
                        unlimitedTierOffered,
                        unlimitedAvailable,
                        loadingPlan === "unlimited",
                        audience === "marketing" ? "Sign up" : paidCta,
                      )}
            </PlanPickerCta>
          </PlanPickerCard>
        ) : null}
      </Grid>

      {audience === "app" ? (
        <PlanCancellationDialog
          open={cancellationOpen}
          onOpenChange={handleCancellationOpenChange}
          targetPlan={downgradeTarget}
          currentPlanName={cancellationCurrentPlanName}
          paidAccessEndsAt={cancellationPaidAccessEndsAt}
          benefitsLost={cancellationBenefitsLost}
          earnedDiscountCents={cancellationEarnedDiscountCents}
          earnedDiscountCurrency={cancellationEarnedDiscountCurrency}
          omitAudPrefix={omitAudPrefix}
          reason={cancellationReason}
          onReasonChange={setCancellationReason}
          comment={cancellationComment}
          onCommentChange={setCancellationComment}
          confirming={cancellationConfirming}
          error={cancellationError}
          onConfirm={() => void confirmDowngrade()}
        />
      ) : null}
    </div>
  );
}
