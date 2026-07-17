"use client";

import Link from "next/link";
import { Badge, Skeleton } from "@altitutor/ui";
import { Check, Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotaProgressBar } from "@/features/ucat-access/components/quota-usage-card";
import {
  useQuotaLimitDialog,
  useUpsellDialog,
} from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { formatQuotaPeriodLabel } from "@/features/ucat-access/lib/format-quota-period";
import type { UcatQuotaArea } from "@/features/ucat-access/types/quota";
import {
  dashboardDiscountState,
  quotaAreaForTask,
  selectDashboardQuotaArea,
} from "@/features/dashboard/lib/dashboard-home";
import type { StudyPlanTask } from "@/features/study-plan/model/types";
import { usePracticeDiscountDashboard } from "@/features/subscription/hooks/use-practice-discount-dashboard";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import {
  UCAT_ONLINE_TIER_LABELS,
  UCAT_PLAN_TIER_BADGE_CLASS,
} from "@/features/subscription/lib/plan-tier-display";

type DashboardMembershipValueProps = {
  nextTask: StudyPlanTask | null;
};

function quotaUnit(area: UcatQuotaArea, count: number): string {
  const plural = count === 1 ? "" : "s";
  switch (area) {
    case "practice":
      return `practice question${plural}`;
    case "learn":
      return `learning module${plural}`;
    case "sets":
      return `set attempt${plural}`;
    case "mocks":
      return `mock attempt${plural}`;
    case "skill_trainer":
      return `Skill trainer attempt${plural}`;
  }
}

function taskContributesQuestions(task: StudyPlanTask | null): boolean {
  return Boolean(
    task &&
      (task.taskType === "practice" ||
        task.taskType === "skill_trainer" ||
        task.taskType === "section_benchmark" ||
        task.taskType === "mock"),
  );
}

export function DashboardMembershipValue({
  nextTask,
}: DashboardMembershipValueProps) {
  const access = useUcatAccess();
  const quotaQuery = useQuotaUsage();
  const discountQuery = usePracticeDiscountDashboard();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { openPlanPicker } = useUpsellDialog();

  const quotaData = quotaQuery.data;
  const accessIndicatesFree =
    !access.isLoading && access.onlineTier === "free" && !access.isQuotaExempt;
  const quotaIndicatesFree =
    !quotaQuery.isLoading &&
    !quotaQuery.isError &&
    quotaData?.onlineTier === "free" &&
    !quotaData.isQuotaExempt;
  const isFreeTier = accessIndicatesFree || quotaIndicatesFree;
  const accessIndicatesPaid =
    !access.isLoading &&
    access.onlineTier !== null &&
    access.onlineTier !== "free" &&
    access.isQuotaExempt;
  const quotaIndicatesPaid =
    !quotaQuery.isLoading &&
    !quotaQuery.isError &&
    quotaData?.onlineTier !== undefined &&
    quotaData.onlineTier !== "free" &&
    quotaData.isQuotaExempt;
  const isPaidTier = accessIndicatesPaid || quotaIndicatesPaid;

  if (access.isLoading || (isFreeTier && quotaQuery.isLoading)) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (isFreeTier) {
    const area = quotaData
      ? selectDashboardQuotaArea(quotaData.areas, quotaAreaForTask(nextTask))
      : null;

    if (!area) {
      return (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h3 className="text-sm font-semibold">Your plan value</h3>
            <Badge className={UCAT_PLAN_TIER_BADGE_CLASS}>UCAT Free</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Unlimited removes online study limits across Altitutor.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              openPlanPicker({
                title: "Upgrade to UCAT Unlimited",
                description:
                  "Remove online quotas and unlock practice-day discounts.",
              })
            }
          >
            See Unlimited
          </Button>
        </div>
      );
    }

    const remaining = Math.max(0, area.limit - area.used);
    const periodLabel = formatQuotaPeriodLabel(area.period);
    const usageRatio = area.limit ? area.used / area.limit : 0;
    const availableResets =
      quotaData?.quotaResetEntitlement.availableCount ?? 0;
    const handleUpgrade = () => {
      if (area.atLimit) {
        openQuotaLimit({
          code: "QUOTA_EXCEEDED",
          area: area.area,
          used: area.used,
          limit: area.limit,
          period: area.period,
        });
        return;
      }
      openPlanPicker({
        title: "Upgrade to UCAT Unlimited",
        description: "Remove online quotas and unlock practice-day discounts.",
      });
    };

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Your plan value</h3>
          <Badge className={UCAT_PLAN_TIER_BADGE_CLASS}>UCAT Free</Badge>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <p className="font-medium">
              {area.atLimit
                ? `${area.label} limit reached ${periodLabel}`
                : `${remaining} ${quotaUnit(area.area, remaining)} remaining ${periodLabel}`}
            </p>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {area.used}/{area.limit}
            </span>
          </div>
          <QuotaProgressBar
            used={area.used}
            limit={area.limit}
            atLimit={area.atLimit}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {area.atLimit
            ? availableResets > 0
              ? `You have ${availableResets} quota reset${availableResets === 1 ? "" : "s"} available, or upgrade to keep going without limits.`
              : "Upgrade to continue without waiting for the quota to reset."
            : usageRatio >= 0.75
              ? "You’re close to this limit. Unlimited removes every online quota."
              : "Unlimited removes every online quota and adds practice-day discounts."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={handleUpgrade}>
            {area.atLimit ? "Upgrade to Unlimited" : "See Unlimited"}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/settings/plan">Quota details</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!isPaidTier) return null;

  const displayTier = access.onlineTier ?? quotaData?.onlineTier ?? null;
  const tierLabel = displayTier
    ? (UCAT_ONLINE_TIER_LABELS[displayTier] ?? "Paid plan")
    : "Paid plan";
  const discount = discountQuery.data;

  if (discountQuery.isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (!discount || discountQuery.isError) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Your plan value</h3>
          <Badge className={UCAT_PLAN_TIER_BADGE_CLASS}>{tierLabel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Your online study areas have no usage quotas.
        </p>
        <Button asChild size="sm" variant="ghost">
          <Link href="/settings/plan">Plan details</Link>
        </Button>
      </div>
    );
  }

  const state = dashboardDiscountState(discount);
  if (state === "unavailable") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Your plan value</h3>
          <Badge className={UCAT_PLAN_TIER_BADGE_CLASS}>{tierLabel}</Badge>
        </div>
        <p className="text-sm font-medium">Unlimited online study is active</p>
        <p className="text-xs text-muted-foreground">
          Learn, practise, and take sets or mocks without online quotas.
        </p>
        <Button asChild size="sm" variant="ghost">
          <Link href="/settings/plan">Plan details</Link>
        </Button>
      </div>
    );
  }

  const dailyDiscount = formatMoneyFromMinorUnits(
    discount.discountPerDayCents,
    discount.currency,
  );
  const periodDiscount = formatMoneyFromMinorUnits(
    discount.totalDiscountCents,
    discount.currency,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {state === "in_progress" ? (
          <Gift className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <Check className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        <h3 className="text-sm font-semibold">Practice-day reward</h3>
        <Badge className={UCAT_PLAN_TIER_BADGE_CLASS}>{tierLabel}</Badge>
      </div>

      {state === "in_progress" ? (
        <>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <p className="font-medium">
                {discount.today.remainingQuestions} more question
                {discount.today.remainingQuestions === 1 ? "" : "s"} to earn{" "}
                {dailyDiscount} off
              </p>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {discount.today.questionsDone}/{discount.today.minQuestions}
              </span>
            </div>
            <QuotaProgressBar
              used={discount.today.questionsDone}
              limit={discount.today.minQuestions}
              atLimit={false}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {taskContributesQuestions(nextTask)
              ? "Today’s recommended task counts toward this reward."
              : `${periodDiscount} earned this billing period so far.`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!taskContributesQuestions(nextTask) ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/practice">Practice now</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="ghost">
              <Link href="/settings/plan">How discounts work</Link>
            </Button>
          </div>
        </>
      ) : state === "earned_today" ? (
        <>
          <p className="text-sm font-medium">
            Today’s {dailyDiscount} discount is secured
          </p>
          <p className="text-xs text-muted-foreground">
            You’ve earned {periodDiscount} off your next bill so far.
          </p>
          <Button asChild size="sm" variant="ghost">
            <Link href="/settings/plan">View discount details</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">
            Maximum discount earned this billing period
          </p>
          <p className="text-xs text-muted-foreground">
            {periodDiscount} is coming off your next bill.
          </p>
          <Button asChild size="sm" variant="ghost">
            <Link href="/settings/plan">View discount details</Link>
          </Button>
        </>
      )}
    </div>
  );
}
