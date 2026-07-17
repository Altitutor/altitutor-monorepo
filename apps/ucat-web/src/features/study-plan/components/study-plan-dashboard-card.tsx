"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Sparkles,
} from "lucide-react";
import { StudyPlanTaskList } from "@/features/study-plan/components/study-plan-task-list";
import { StudyPlanExtraStudy } from "@/features/study-plan/components/study-plan-extra-study";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import {
  UCAT_CARD_CHROME,
  UCAT_NEUTRAL_ACTION_HOVER,
} from "@/lib/ucat-surface-motion";

export function StudyPlanDashboardCard() {
  const query = useStudyPlan();
  if (query.isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (query.isError) {
    return (
      <Card className={UCAT_CARD_CHROME}>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Your Study plan could not be loaded.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }
  const plan = query.data;
  if (!plan?.profile) {
    return (
      <Card className={UCAT_CARD_CHROME}>
        <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold">
                Create your personalised Study plan
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us your target and availability. We will tell you what to
                do next.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/study-plan/setup">Set up Study plan</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const tasks = plan.todayTasks;
  return (
    <Card className={UCAT_CARD_CHROME}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck2 className="h-5 w-5 text-primary" /> Today’s Study
            plan
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.completion.scheduledThroughToday
              ? `${plan.completion.percent}% of scheduled work completed so far`
              : "Your workload will build as your test approaches"}
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={UCAT_NEUTRAL_ACTION_HOVER}
        >
          <Link href="/study-plan">
            Full plan <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {plan.generation?.capacityRisk.level === "warning" ? (
          <div className="flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{plan.generation.capacityRisk.message}</span>
          </div>
        ) : null}
        {tasks.length ? (
          <StudyPlanTaskList tasks={tasks} compact today={plan.today} />
        ) : null}
        <StudyPlanExtraStudy plan={plan} />
      </CardContent>
    </Card>
  );
}
