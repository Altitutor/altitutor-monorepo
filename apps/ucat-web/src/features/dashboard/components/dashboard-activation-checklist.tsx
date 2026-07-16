"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, Skeleton } from "@altitutor/ui";
import { ArrowRight, Check, Circle, ListChecks, Lock } from "lucide-react";
import {
  useCompleteOnboardingTour,
  useOnboardingProgress,
} from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  UCAT_FIRST_RESULT_REVIEWED,
  UCAT_FIRST_STUDY_PLAN_TASK_COMPLETED,
  UCAT_GUIDED_SAMPLER_COMPLETED,
  UCAT_GUIDED_SAMPLER_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import {
  UCAT_CARD_CHROME,
  UCAT_COMPLETED_ITEM_SURFACE,
  UCAT_FOCUS_RING_INSET,
  UCAT_PRESSABLE_SURFACE_HOVER,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

export function DashboardActivationChecklist() {
  const progress = useOnboardingProgress();
  const planQuery = useStudyPlan();
  const completeMilestone = useCompleteOnboardingTour();
  const persistedTaskCompletionRef = useRef(false);
  const observedCompletedTask = Boolean(
    planQuery.data?.tasks.some((task) => task.status === "completed"),
  );

  useEffect(() => {
    if (!observedCompletedTask || persistedTaskCompletionRef.current) return;
    if (progress.isCompleted(UCAT_FIRST_STUDY_PLAN_TASK_COMPLETED)) return;
    persistedTaskCompletionRef.current = true;
    completeMilestone.mutate(UCAT_FIRST_STUDY_PLAN_TASK_COMPLETED);
  }, [completeMilestone, observedCompletedTask, progress]);

  if (progress.isLoading || planQuery.isLoading) {
    return <Skeleton className="h-44 w-full rounded-2xl" />;
  }

  if (!progress.isCompleted(UCAT_GUIDED_SAMPLER_DECIDED)) return null;

  const hasPlan = Boolean(planQuery.data?.profile);
  const hasCompletedFirstTask =
    observedCompletedTask ||
    progress.isCompleted(UCAT_FIRST_STUDY_PLAN_TASK_COMPLETED);
  const items = [
    {
      label: "Explore all four UCAT sections",
      complete: progress.isCompleted(UCAT_GUIDED_SAMPLER_COMPLETED),
      unlocked: true,
      href: "/signup/complete/sampler?replay=1&familiarity=familiar",
      action: "Explore",
    },
    {
      label: "Build your Study plan",
      complete: hasPlan,
      unlocked: true,
      href: "/study-plan/setup",
      action: "Build",
    },
    {
      label: "Complete your first Study plan task",
      complete: hasCompletedFirstTask,
      unlocked: hasPlan,
      href: "/study-plan",
      action: "View task",
    },
    {
      label: "Review your first real result",
      complete: progress.isCompleted(UCAT_FIRST_RESULT_REVIEWED),
      unlocked: hasCompletedFirstTask,
      href: "/progress",
      action: "Review",
    },
  ];
  const completedCount = items.filter((item) => item.complete).length;
  if (completedCount === items.length) return null;

  return (
    <Card className={cn(UCAT_CARD_CHROME, "max-w-2xl")}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <ListChecks className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              Get set up for smarter practice
            </h2>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {items.length} complete
            </p>
          </div>
        </div>

        <div className="mt-3 divide-y overflow-hidden rounded-xl border">
          {items.map((item) => {
            const rowClassName = cn(
              "flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm",
              item.unlocked &&
                !item.complete && [
                  UCAT_SURFACE_MOTION,
                  UCAT_PRESSABLE_SURFACE_HOVER,
                  UCAT_FOCUS_RING_INSET,
                ],
              item.complete && UCAT_COMPLETED_ITEM_SURFACE,
              !item.unlocked && "cursor-not-allowed bg-muted/35",
            );
            const contents = (
              <>
                <span className="shrink-0 text-muted-foreground">
                  {item.complete ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : item.unlocked ? (
                    <Circle className="h-4 w-4" aria-hidden />
                  ) : (
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium",
                    item.complete && "text-muted-foreground line-through",
                    !item.unlocked && "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
                {!item.complete && item.unlocked ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                    {item.action}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                ) : null}
              </>
            );

            return item.unlocked && !item.complete ? (
              <Link key={item.label} href={item.href} className={rowClassName}>
                {contents}
              </Link>
            ) : (
              <div
                key={item.label}
                className={rowClassName}
                aria-disabled={!item.unlocked || undefined}
              >
                {contents}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
