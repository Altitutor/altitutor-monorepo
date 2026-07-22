"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Badge, Skeleton } from "@altitutor/ui";
import { Check, ChevronDown, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PracticeStreakWeek } from "@/features/streaks/components/practice-streak-week";
import { buildPracticeStreak } from "@/features/streaks/lib/practice-streak";
import { useUcatActivity } from "@/features/progress/hooks/use-ucat-activity";
import { SidebarExpandablePanel } from "@/features/layout/components/sidebar-expandable-panel";
import { QuotaProgressBar } from "@/features/ucat-access/components/quota-usage-card";
import {
  useQuotaLimitDialog,
  useUpsellDialog,
} from "@/features/ucat-access/context/upsell-dialog-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import {
  formatQuotaPeriodLabel,
  formatQuotaUsageCompact,
} from "@/features/ucat-access/lib/format-quota-period";
import type {
  UcatQuotaArea,
  UcatQuotaAreaUsage,
} from "@/features/ucat-access/types/quota";
import {
  dashboardDiscountState,
  quotaAreaForTask,
  selectDashboardQuotaArea,
} from "@/features/dashboard/lib/dashboard-home";
import type { StudyPlanTask } from "@/features/study-plan/model/types";
import { usePracticeDiscountDashboard } from "@/features/subscription/hooks/use-practice-discount-dashboard";
import { useUcatReferralSummary } from "@/features/subscription/hooks/use-ucat-referral-summary";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import {
  UCAT_ONLINE_TIER_LABELS,
  UCAT_PLAN_TIER_BADGE_CLASS,
} from "@/features/subscription/lib/plan-tier-display";
import { UCAT_NEUTRAL_ACTION_HOVER } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type DashboardMembershipValueProps = { nextTask: StudyPlanTask | null };

function quotaUnit(area: UcatQuotaArea, count: number): string {
  const plural = count === 1 ? "" : "s";
  if (area === "practice") return `practice question${plural}`;
  if (area === "learn") return `learning module${plural}`;
  if (area === "sets") return `set attempt${plural}`;
  if (area === "mocks") return `mock attempt${plural}`;
  return `Skill trainer attempt${plural}`;
}

function Celebration({
  kind,
  title,
  detail,
}: {
  kind: "discount" | "free_bill";
  title: string;
  detail: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-400/[0.16] via-background to-primary/[0.08] px-3 py-3">
      {!reduceMotion
        ? [0, 1, 2, 3, 4].map((particle) => (
            <motion.span
              key={particle}
              className="absolute h-1.5 w-1.5 rounded-full bg-amber-400"
              style={{ left: `${15 + particle * 18}%` }}
              initial={{ y: 22, opacity: 0, scale: 0 }}
              animate={{
                y: [-4, -18, -8],
                opacity: [0, 1, 0],
                scale: [0, 1, 0.6],
              }}
              transition={{ duration: 1.8, delay: particle * 0.12, repeat: 1 }}
              aria-hidden
            />
          ))
        : null}
      <div className="relative flex items-start gap-3">
        <motion.span
          initial={reduceMotion ? false : { rotate: -12, scale: 0.7 }}
          animate={{ rotate: 0, scale: 1 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm"
        >
          {kind === "free_bill" ? (
            <Gift className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </motion.span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardMembershipValue({
  nextTask,
}: DashboardMembershipValueProps) {
  const access = useUcatAccess();
  const quotaQuery = useQuotaUsage();
  const activityQuery = useUcatActivity();
  const discountQuery = usePracticeDiscountDashboard();
  const referralQuery = useUcatReferralSummary();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const { openPlanPicker } = useUpsellDialog();
  const quotaData = quotaQuery.data;
  const isFreeTier =
    (!access.isLoading &&
      access.onlineTier === "free" &&
      !access.isQuotaExempt) ||
    (!quotaQuery.isLoading &&
      quotaData?.onlineTier === "free" &&
      !quotaData.isQuotaExempt);
  const isPaidTier =
    (!access.isLoading &&
      access.onlineTier != null &&
      access.onlineTier !== "free" &&
      access.isQuotaExempt) ||
    (!quotaQuery.isLoading &&
      quotaData?.onlineTier != null &&
      quotaData.onlineTier !== "free" &&
      quotaData.isQuotaExempt);

  if (
    access.isLoading ||
    activityQuery.isLoading ||
    (isFreeTier && quotaQuery.isLoading)
  ) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }
  if (!isFreeTier && !isPaidTier) return null;

  const streak = buildPracticeStreak(
    activityQuery.data?.days ?? [],
    activityQuery.data?.timezone ?? "Australia/Adelaide",
  );
  const displayTier = access.onlineTier ?? quotaData?.onlineTier ?? null;
  const tierLabel = isFreeTier
    ? "UCAT Free"
    : displayTier
      ? (UCAT_ONLINE_TIER_LABELS[displayTier] ?? "Paid plan")
      : "Paid plan";
  const nextBillFree =
    referralQuery.data?.stats.nextBillFreeFromReferral === true;
  const queuedRewards = referralQuery.data?.stats.queuedFreeBills ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Practice streak</h3>
          <Badge className={`mt-1.5 ${UCAT_PLAN_TIER_BADGE_CLASS}`}>
            {tierLabel}
          </Badge>
        </div>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className={UCAT_NEUTRAL_ACTION_HOVER}
        >
          <Link href="/settings/plan">View plan</Link>
        </Button>
      </div>

      <PracticeStreakWeek streak={streak} />

      {isFreeTier ? (
        <FreePlanQuota
          nextTask={nextTask}
          quotaData={quotaData}
          onUpgrade={() =>
            openPlanPicker({
              title: "Upgrade to UCAT Unlimited",
              description:
                "Remove online quotas and earn discounts as you practise.",
            })
          }
          onLimit={openQuotaLimit}
        />
      ) : (
        <PaidPlanReward
          discount={discountQuery.data}
          discountLoading={discountQuery.isLoading}
          nextBillFree={nextBillFree}
          queuedRewards={queuedRewards}
        />
      )}
    </div>
  );
}

function FreePlanQuotaRow({ area }: { area: UcatQuotaAreaUsage }) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{area.label}</span>
        <span
          className={cn(
            "shrink-0 tabular-nums text-xs text-muted-foreground",
            area.atLimit && "font-medium text-destructive",
          )}
        >
          {formatQuotaUsageCompact(area.used, area.limit, area.period)}
        </span>
      </div>
      <QuotaProgressBar
        used={area.used}
        limit={area.limit}
        atLimit={area.atLimit}
      />
    </li>
  );
}

function FreePlanQuota({
  nextTask,
  quotaData,
  onUpgrade,
  onLimit,
}: {
  nextTask: StudyPlanTask | null;
  quotaData: ReturnType<typeof useQuotaUsage>["data"];
  onUpgrade: () => void;
  onLimit: ReturnType<typeof useQuotaLimitDialog>["openQuotaLimit"];
}) {
  const [expanded, setExpanded] = useState(false);
  const enabledAreas =
    quotaData?.areas.filter((entry) => !entry.disabled && entry.limit > 0) ??
    [];
  const area = quotaData
    ? selectDashboardQuotaArea(enabledAreas, quotaAreaForTask(nextTask))
    : null;
  if (!area) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
        <p className="text-sm font-medium">
          Keep your streak. Lose the limits.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Unlimited gives you unrestricted practice across every study area.
        </p>
        <Button size="sm" className="mt-3" onClick={onUpgrade}>
          Explore Unlimited
        </Button>
      </div>
    );
  }
  const remaining = Math.max(0, area.limit - area.used);
  const otherAreas = enabledAreas.filter((entry) => entry.area !== area.area);
  const handleAction = () => {
    if (area.atLimit) {
      onLimit({
        code: "QUOTA_EXCEEDED",
        area: area.area,
        used: area.used,
        limit: area.limit,
        period: area.period,
      });
    } else onUpgrade();
  };
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/25 p-3">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-medium">
          {area.atLimit
            ? `${area.label} limit reached`
            : `${remaining} ${quotaUnit(area.area, remaining)} remaining`}
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">
          {area.used}/{area.limit}
        </span>
      </div>
      <QuotaProgressBar
        used={area.used}
        limit={area.limit}
        atLimit={area.atLimit}
      />
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          {formatQuotaPeriodLabel(area.period)}
        </p>
        <Button size="sm" onClick={handleAction}>
          {area.atLimit ? "Go Unlimited" : "Get unlimited practice"}
        </Button>
      </div>
      {otherAreas.length > 0 ? (
        <div className="border-t border-border/50 pt-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="practice-streak-all-limits"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors",
              UCAT_NEUTRAL_ACTION_HOVER,
            )}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? "Hide all limits" : "All limits"}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          <SidebarExpandablePanel expanded={expanded}>
            <ul
              id="practice-streak-all-limits"
              className="mt-2 space-y-2.5"
            >
              {otherAreas.map((entry) => (
                <FreePlanQuotaRow key={entry.area} area={entry} />
              ))}
            </ul>
          </SidebarExpandablePanel>
        </div>
      ) : null}
    </div>
  );
}

function PaidPlanReward({
  discount,
  discountLoading,
  nextBillFree,
  queuedRewards,
}: {
  discount: ReturnType<typeof usePracticeDiscountDashboard>["data"];
  discountLoading: boolean;
  nextBillFree: boolean;
  queuedRewards: number;
}) {
  if (discountLoading) return <Skeleton className="h-24 rounded-xl" />;
  const freeBillCelebration = nextBillFree ? (
    <Celebration
      kind="free_bill"
      title="Your next bill is free"
      detail={
        queuedRewards > 1
          ? `${queuedRewards} referral rewards are ready.`
          : "Covered by your referral reward."
      }
    />
  ) : null;
  if (!discount?.eligible) {
    return (
      <div className="space-y-3">
        {freeBillCelebration}
        <p className="text-xs text-muted-foreground">
          Unlimited practice is active on your plan.
        </p>
      </div>
    );
  }
  const state = dashboardDiscountState(discount);
  const dailyDiscount = formatMoneyFromMinorUnits(
    discount.discountPerDayCents,
    discount.currency,
  );
  const periodDiscount = formatMoneyFromMinorUnits(
    discount.totalDiscountCents,
    discount.currency,
  );
  if (state === "earned_today" || state === "period_complete") {
    return (
      <div className="space-y-3">
        {freeBillCelebration}
        <Celebration
          kind="discount"
          title={
            state === "period_complete"
              ? "Maximum discount unlocked"
              : `${dailyDiscount} discount earned today`
          }
          detail={`${periodDiscount} saved this billing period.`}
        />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {freeBillCelebration}
      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/25 p-3">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="font-medium">
            {discount.today.remainingQuestions} more question
            {discount.today.remainingQuestions === 1 ? "" : "s"} for{" "}
            {dailyDiscount} off
          </p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {discount.today.questionsDone}/{discount.today.minQuestions}
          </span>
        </div>
        <QuotaProgressBar
          used={discount.today.questionsDone}
          limit={discount.today.minQuestions}
          atLimit={false}
        />
        <p className="text-xs text-muted-foreground">
          {periodDiscount} saved this billing period so far.
        </p>
      </div>
    </div>
  );
}
