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
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

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

  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Recent attempts</h2>
          </div>
          <Button asChild size="sm" variant="ghost">
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
        ) : attemptsQuery.data?.attempts.length ? (
          <div className="mt-4 divide-y divide-border/60">
            {attemptsQuery.data.attempts.map((attempt) => (
              <Link
                key={`${attempt.source}-${attempt.id}`}
                href={attemptHref(attempt)}
                className="group flex items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                  Review
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm font-medium">No completed attempts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Finished practice, sets, and mocks will appear here for review.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
