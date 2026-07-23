"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, Skeleton } from "@altitutor/ui";
import { ArrowRight, Check, Circle, ListChecks } from "lucide-react";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  UCAT_GUIDED_SAMPLER_DECIDED,
  UCAT_REFERRAL_SHARED,
  UCAT_STUDY_PLAN_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";
import { useProgressAttempts } from "@/features/progress/hooks/use-progress-attempts";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import { ReferralDialog } from "@/features/subscription/components/referral-dialog";
import {
  UCAT_CARD_CHROME,
  UCAT_COMPLETED_ITEM_SURFACE,
  UCAT_FOCUS_RING_INSET,
  UCAT_PRESSABLE_SURFACE_HOVER,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { UCAT_PRODUCT_NAME } from "@/lib/ucat-brand";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  label: string;
  complete: boolean;
  action: string;
  href?: string;
  onClick?: () => void;
};

export function DashboardActivationChecklist() {
  const [referralOpen, setReferralOpen] = useState(false);
  const progress = useOnboardingProgress();
  const planQuery = useStudyPlan();
  const attemptsQuery = useProgressAttempts({
    source: "all",
    page: 1,
    pageSize: 1,
    dateRange: "all",
  });

  if (progress.isLoading || planQuery.isLoading || attemptsQuery.isLoading) {
    return <Skeleton className="h-56 w-full rounded-2xl" />;
  }

  if (!progress.isCompleted(UCAT_GUIDED_SAMPLER_DECIDED)) return null;

  const profile = planQuery.data?.profile;
  const hasGoal = Boolean(profile?.testYear && profile?.targetScore);
  const items: ChecklistItem[] = [
    {
      label: "Set my UCAT year and target score",
      complete: hasGoal,
      href: "/ucat-goal/setup",
      action: "Set goal",
    },
    {
      label: "Set up my Study plan",
      complete: progress.isCompleted(UCAT_STUDY_PLAN_DECIDED),
      href: "/study-plan/setup?section=plan",
      action: "Choose",
    },
    {
      label: "Do your first UCAT question",
      complete: (attemptsQuery.data?.total ?? 0) > 0,
      href: "/practice",
      action: "Practice",
    },
    {
      label: "Refer a friend",
      complete: progress.isCompleted(UCAT_REFERRAL_SHARED),
      action: "Invite",
      onClick: () => setReferralOpen(true),
    },
  ];
  const completedCount = items.filter((item) => item.complete).length;
  if (completedCount === items.length) return null;

  return (
    <>
      <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ListChecks className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">
                Finish setting up {UCAT_PRODUCT_NAME}
              </h2>
              <p className="text-xs text-muted-foreground">
                {completedCount} of {items.length} complete
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            {items.map((item) => {
              const rowClassName = cn(
                "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm",
                !item.complete && [
                  UCAT_SURFACE_MOTION,
                  UCAT_PRESSABLE_SURFACE_HOVER,
                  UCAT_FOCUS_RING_INSET,
                ],
                item.complete && UCAT_COMPLETED_ITEM_SURFACE,
              );
              const contents = (
                <>
                  <span className="shrink-0 text-muted-foreground">
                    {item.complete ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Circle className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 font-medium",
                      item.complete && "text-muted-foreground line-through",
                    )}
                  >
                    {item.label}
                  </span>
                  {!item.complete ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                      {item.action}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : null}
                </>
              );

              if (item.complete) {
                return (
                  <div key={item.label} className={rowClassName}>
                    {contents}
                  </div>
                );
              }
              if (item.href) {
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={rowClassName}
                  >
                    {contents}
                  </Link>
                );
              }
              return (
                <button
                  key={item.label}
                  type="button"
                  className={rowClassName}
                  onClick={item.onClick}
                >
                  {contents}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ReferralDialog open={referralOpen} onOpenChange={setReferralOpen} />
    </>
  );
}
