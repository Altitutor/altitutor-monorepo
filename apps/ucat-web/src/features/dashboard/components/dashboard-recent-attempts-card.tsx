"use client";

import Link from "next/link";
import { Card, CardContent, Skeleton } from "@altitutor/ui";
import {
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  FileStack,
} from "lucide-react";
import type { ProgressAttemptRow } from "@/app/api/ucat/progress/attempts/route";
import { Button } from "@/components/ui/button";
import { useProgressAttempts } from "@/features/progress/hooks/use-progress-attempts";
import {
  UCAT_CARD_CHROME,
  UCAT_CONTROL_PRESS,
  UCAT_FOCUS_RING_INSET,
  UCAT_NEUTRAL_ACTION_HOVER,
  UCAT_PRESSABLE_SURFACE_HOVER,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  UnreviewedAttemptDot,
  UnreviewedAttemptTooltip,
} from "@/features/progress/components/unreviewed-attempt-indicator";

function attemptName(attempt: ProgressAttemptRow): string {
  switch (attempt.source) {
    case "practice":
      return `${attempt.sectionName} practice`;
    case "set":
      return attempt.questionSetName ?? "UCAT set";
    case "mock":
      return attempt.mockName ?? "UCAT mock";
  }
}

function attemptScore(attempt: ProgressAttemptRow): string {
  if (attempt.source !== "practice" && attempt.scaledScore != null) {
    return `${attempt.scaledScore} scaled`;
  }
  if (attempt.scorePoints != null && attempt.totalPoints) {
    return `${attempt.scorePoints}/${attempt.totalPoints} correct`;
  }
  return "Ready to review";
}

function attemptHref(attempt: ProgressAttemptRow): string {
  switch (attempt.source) {
    case "practice":
      return `/progress/practice-sessions/${attempt.id}`;
    case "set":
      return `/progress/set-attempts/${attempt.id}`;
    case "mock":
      return `/progress/mocks/mock-attempts/${attempt.id}`;
  }
}

function attemptDate(attempt: ProgressAttemptRow): string {
  const value = attempt.completedAt ?? attempt.attemptedAt;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function AttemptIcon({ source }: { source: ProgressAttemptRow["source"] }) {
  const Icon =
    source === "mock"
      ? ClipboardCheck
      : source === "set"
        ? FileStack
        : BrainCircuit;
  return <Icon className="size-4" aria-hidden />;
}

export function DashboardRecentAttemptsCard() {
  const attemptsQuery = useProgressAttempts({
    source: "all",
    page: 1,
    pageSize: 4,
    dateRange: "all",
    completedOnly: true,
  });

  const attempts = attemptsQuery.data?.attempts ?? [];
  const hasAttempts = attempts.length > 0;

  if (!attemptsQuery.isLoading && !attemptsQuery.isError && !hasAttempts) {
    return null;
  }

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Recent attempts</h2>
          </div>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className={UCAT_NEUTRAL_ACTION_HOVER}
          >
            <Link href="/progress">All progress</Link>
          </Button>
        </div>

        {attemptsQuery.isLoading ? (
          <div className="mt-5 space-y-2">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : attemptsQuery.isError ? (
          <p className="mt-5 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Recent attempts are temporarily unavailable. Your results remain
            available in Progress.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border/60">
            {attempts.map((attempt) => {
              const attemptLink = (
                <Link
                  key={`${attempt.source}-${attempt.id}`}
                  href={attemptHref(attempt)}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-2 py-2.5",
                    UCAT_CONTROL_PRESS,
                    UCAT_PRESSABLE_SURFACE_HOVER,
                    UCAT_FOCUS_RING_INSET,
                  )}
                  aria-label={
                    attempt.reviewCompletedAt == null
                      ? `${attemptName(attempt)}. This attempt is unreviewed.`
                      : undefined
                  }
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                    <AttemptIcon source={attempt.source} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {attemptName(attempt)}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {attemptScore(attempt)} · {attemptDate(attempt)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary">
                    Review
                    {attempt.reviewCompletedAt == null ? (
                      <UnreviewedAttemptDot />
                    ) : null}
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              );
              return attempt.reviewCompletedAt == null ? (
                <UnreviewedAttemptTooltip
                  key={`${attempt.source}-${attempt.id}`}
                >
                  {attemptLink}
                </UnreviewedAttemptTooltip>
              ) : (
                attemptLink
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
