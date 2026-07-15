"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button, Card, CardContent, Skeleton } from "@altitutor/ui";
import { ArrowRight, Check, Circle, ListChecks, Sparkles } from "lucide-react";
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
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
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
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  // Existing students are not retroactively placed into the new activation
  // journey. Every new path records this milestone, including an explicit skip.
  if (!progress.isCompleted(UCAT_GUIDED_SAMPLER_DECIDED)) return null;

  const items = [
    {
      label: "Explore all four UCAT sections",
      description: "Finish the guided, unscored sampler.",
      complete: progress.isCompleted(UCAT_GUIDED_SAMPLER_COMPLETED),
      href: "/signup/complete/sampler?replay=1&familiarity=familiar",
      action: "Explore",
    },
    {
      label: "Build your Study plan",
      description: "Turn your target and available time into next actions.",
      complete: Boolean(planQuery.data?.profile),
      href: "/getting-started",
      action: "Build",
    },
    {
      label: "Complete your first Study plan task",
      description: "Give the plan its first real signal.",
      complete:
        observedCompletedTask ||
        progress.isCompleted(UCAT_FIRST_STUDY_PLAN_TASK_COMPLETED),
      href: "/study-plan",
      action: "View task",
    },
    {
      label: "Review your first real result",
      description: "Use feedback to understand what to do next.",
      complete: progress.isCompleted(UCAT_FIRST_RESULT_REVIEWED),
      href: "/progress",
      action: "Review",
    },
  ];
  const completedCount = items.filter((item) => item.complete).length;
  if (completedCount === items.length) return null;
  const nextItem = items.find((item) => !item.complete);

  return (
    <Card className={cn(UCAT_CARD_CHROME, "border-primary/20")}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ListChecks className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">
                  Get set up for smarter practice
                </h2>
                <span className="text-xs text-muted-foreground">
                  {completedCount} of {items.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Each step helps Altitutor give you a clearer next
                recommendation.
              </p>
            </div>
          </div>
          {nextItem ? (
            <Button asChild size="sm">
              <Link href={nextItem.href}>
                {nextItem.action}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex gap-3 rounded-xl border p-3 transition-colors",
                item.complete
                  ? "border-emerald-500/15 bg-emerald-500/[0.04]"
                  : "border-border/60 hover:border-primary/30 hover:bg-primary/[0.03]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5",
                  item.complete ? "text-emerald-600" : "text-muted-foreground",
                )}
              >
                {item.complete ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span>
                <span
                  className={cn(
                    "block text-sm font-medium",
                    item.complete && "text-muted-foreground line-through",
                  )}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          This checklist disappears when you finish it.
        </p>
      </CardContent>
    </Card>
  );
}
