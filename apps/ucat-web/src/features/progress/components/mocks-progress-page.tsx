"use client";

import { useMemo } from "react";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useProgress } from "../hooks/use-progress";
import { MockAttemptsCard } from "./mock-attempts-card";
import { filterByTimeFrame } from "../lib/progress-data-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { AnimatedInteger } from "./progress-animated-display";
import { formatUcatPercentile } from "../lib/percentiles";

export function MocksProgressPage() {
  const { data, isLoading, error } = useProgress();

  const filteredMockAttempts = useMemo(() => {
    if (!data?.mockAttempts) return [];
    return filterByTimeFrame(data.mockAttempts, "all_time", "30");
  }, [data]);

  const averageMockScore = useMemo(() => {
    const withScore = filteredMockAttempts.filter(
      (a) => a.scaledScore != null && a.scaledScore > 0,
    );
    if (withScore.length === 0) return null;
    const sum = withScore.reduce((s, a) => s + (a.scaledScore ?? 0), 0);
    return Math.round(sum / withScore.length);
  }, [filteredMockAttempts]);
  const averageMockPercentile = formatUcatPercentile(averageMockScore, "mock");
  const sectionBreakdown = useMemo(() => {
    if (!data) return [];

    const mockIds = new Set(filteredMockAttempts.map((attempt) => attempt.id));
    const scoreByMockAndSection = new Map<string, number>();

    for (const attempt of data.setAttempts) {
      if (
        attempt.studentUcatMockAttemptId == null ||
        !mockIds.has(attempt.studentUcatMockAttemptId) ||
        attempt.sectionId == null ||
        attempt.scaledScore == null
      ) {
        continue;
      }

      const key = `${attempt.studentUcatMockAttemptId}:${attempt.sectionId}`;
      scoreByMockAndSection.set(
        key,
        (scoreByMockAndSection.get(key) ?? 0) + attempt.scaledScore,
      );
    }

    return data.sectionProgress.map((section) => {
      const scores = filteredMockAttempts
        .map((mock) =>
          scoreByMockAndSection.get(`${mock.id}:${section.sectionId}`),
        )
        .filter((score): score is number => score != null);
      const averageScore =
        scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : null;

      return {
        sectionId: section.sectionId,
        sectionName: section.sectionName,
        averageScore,
        percentile: formatUcatPercentile(averageScore, "section"),
      };
    });
  }, [data, filteredMockAttempts]);

  if (isLoading) {
    return <AppPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock progress"
          description="Could not load your mock progress."
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock progress"
          description="No progress data available."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Mock progress"
        description="Track your performance across mock exams."
      />

      <div className="flex justify-center">
        <Card className={cn(UCAT_CARD_CHROME, "w-full max-w-2xl")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-center">
              Average mock score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div
              className={cn(
                "text-4xl font-bold tabular-nums text-center",
                averageMockScore == null && "text-muted-foreground",
              )}
            >
              {averageMockScore != null ? (
                <AnimatedInteger value={averageMockScore} />
              ) : (
                "—"
              )}
            </div>
            {averageMockPercentile ? (
              <div className="mt-1 text-center text-xs font-medium text-muted-foreground">
                {averageMockPercentile}
              </div>
            ) : null}

            <div className="border-t border-border pt-4">
              <div className="mb-3 text-xs font-medium text-muted-foreground">
                Section breakdown
              </div>
              <div className="space-y-3">
                {sectionBreakdown.map((section) => (
                  <div
                    key={section.sectionId}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {section.sectionName}
                    </span>
                    <div className="shrink-0 text-right">
                      <div
                        className={cn(
                          "font-semibold tabular-nums",
                          section.averageScore == null &&
                            "text-muted-foreground",
                        )}
                      >
                        {section.averageScore ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {section.percentile ?? "No completed mock score"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <MockAttemptsCard attempts={data.mockAttempts} />
    </div>
  );
}
