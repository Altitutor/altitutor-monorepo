"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import type { PracticeDiscountDayEntry } from "@/lib/ucat/practice-day-discount-dashboard";
import { QuotaProgressBar } from "@/features/ucat-access/components/quota-usage-card";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { usePracticeDiscountDashboard } from "@/features/subscription/hooks/use-practice-discount-dashboard";
import { formatMoneyFromMinorUnits } from "@/features/subscription/lib/format-subscription-copy";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_ONLINE_TIER_LABELS,
  UCAT_PLAN_TIER_BADGE_CLASS,
} from "@/features/subscription/lib/plan-tier-display";
import {
  UCAT_CARD_CHROME,
  UCAT_PRESSABLE_LIFT_HOVER,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

const DAY_STATUS_CLASS: Record<
  PracticeDiscountDayEntry["status"],
  string
> = {
  earned: "bg-primary text-primary-foreground",
  in_progress: "bg-primary/30 ring-2 ring-primary/50",
  missed: "bg-muted text-muted-foreground",
};

function WeekDayCell({ day }: { day: PracticeDiscountDayEntry }) {
  const tooltip = day.earnedCredit
    ? `${day.weekdayLabel}: discount earned (${day.questionsDone} questions)`
    : day.isToday
      ? `${day.weekdayLabel}: ${day.questionsDone} / ${day.minQuestions} questions today`
      : `${day.weekdayLabel}: ${day.questionsDone} questions — no discount`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
              DAY_STATUS_CLASS[day.status],
              day.isToday && "ring-2 ring-foreground/20 ring-offset-2 ring-offset-card",
            )}
            aria-label={tooltip}
          >
            {day.earnedCredit ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              day.weekdayLabel.slice(0, 1)
            )}
          </div>
          <span
            className={cn(
              "text-[10px] tabular-nums text-muted-foreground",
              day.isToday && "font-medium text-foreground",
            )}
          >
            {day.weekdayLabel}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-sm">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function DashboardPracticeDiscountCard() {
  const access = useUcatAccess();
  const {
    data: quotaData,
    isLoading: quotaLoading,
    isError: quotaError,
  } = useQuotaUsage();
  const { data, isLoading, isError } = usePracticeDiscountDashboard();

  const accessIndicatesPaid =
    !access.isLoading &&
    access.isQuotaExempt &&
    access.onlineTier !== null &&
    access.onlineTier !== "free";
  const quotaIndicatesPaid =
    !quotaLoading &&
    !quotaError &&
    quotaData?.isQuotaExempt &&
    quotaData.onlineTier !== "free";
  const isPaidTier = accessIndicatesPaid || quotaIndicatesPaid;
  const displayTier = access.onlineTier ?? quotaData?.onlineTier ?? null;

  if (!access.isLoading && !quotaLoading && !isPaidTier) {
    return null;
  }

  if (access.isLoading || quotaLoading || isLoading) {
    return <Skeleton className="h-[280px] rounded-ucatShell" />;
  }

  if (isError || !data) {
    return null;
  }

  const { today } = data;
  const showInvoiceDiscount = data.eligible && data.cap > 0;

  return (
    <Card className={UCAT_CARD_CHROME}>
      <CardHeader className="space-y-1 pb-2">
        <div className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-medium">
                Practice day discounts
              </CardTitle>
              <Badge className={UCAT_PLAN_TIER_BADGE_CLASS}>
                {UCAT_ONLINE_TIER_LABELS[displayTier ?? ""] ?? "UCAT Unlimited"}
              </Badge>
            </div>
            <p className="text-sm font-normal text-muted-foreground">
              Hit your daily question target to earn billing discounts.
            </p>
          </div>
          <Link
            href="/settings/plan"
            className={cn(
              "group -m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-white/35",
              UCAT_SURFACE_MOTION,
              UCAT_PRESSABLE_LIFT_HOVER,
            )}
            aria-label="View plan details"
          >
            <UcatHoverChevron className="h-5 w-5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Today</p>
            {today.earnedCredit ? (
              <Badge variant="default" className="text-[10px]">
                Discount earned
              </Badge>
            ) : showInvoiceDiscount && data.periodCapReached ? (
              <span className="text-xs text-muted-foreground">
                Period cap reached ({data.earned} / {data.cap})
              </span>
            ) : (
              <span className="text-sm tabular-nums text-muted-foreground">
                {today.questionsDone} / {today.minQuestions} questions
              </span>
            )}
          </div>
          {!today.earnedCredit && !(showInvoiceDiscount && data.periodCapReached) ? (
            <>
              <QuotaProgressBar
                used={today.questionsDone}
                limit={today.minQuestions}
                atLimit={today.questionsDone >= today.minQuestions}
              />
              <p className="text-xs text-muted-foreground">
                {today.questionsDone >= today.minQuestions
                  ? "Target reached — discount applies on your next qualifying submission."
                  : today.remainingQuestions === 1
                    ? "1 more question to earn today's discount."
                    : `${today.remainingQuestions} more questions to earn today's discount.`}
              </p>
            </>
          ) : today.earnedCredit && showInvoiceDiscount ? (
            <p className="text-xs text-muted-foreground">
              You&apos;ve earned{" "}
              {formatMoneyFromMinorUnits(
                data.discountPerDayCents,
                data.currency,
              )}{" "}
              off your next invoice for today.
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Last 7 days</p>
          <TooltipProvider delayDuration={200}>
            <div className="flex justify-between gap-1 sm:justify-start sm:gap-3">
              {data.lastSevenDays.map((day) => (
                <WeekDayCell key={day.date} day={day} />
              ))}
            </div>
          </TooltipProvider>
        </div>

        {showInvoiceDiscount ? (
          <div className="rounded-ucatControl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">Next invoice discount</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {formatMoneyFromMinorUnits(data.totalDiscountCents, data.currency)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({data.earned} / {data.cap} days this period)
              </span>
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
