"use client";

import { useMemo } from "react";
import { UcatPageHeader } from "@/features/layout";
import { useProgress } from "../hooks/use-progress";
import { useProgressMode } from "../hooks/use-progress-mode";
import { ProgressModeSelector } from "./progress-mode-selector";
import { SectionProgressCards } from "./section-progress-cards";
import { MockAttemptsCard } from "./mock-attempts-card";
import {
  filterByTimeFrame,
  getSharedDateRange,
  computeSectionProgressFromMockAttempts,
} from "../lib/progress-data-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";

export function MocksProgressPage() {
  const { data, isLoading, error } = useProgress();
  const progressMode = useProgressMode();

  const filteredMockAttempts = useMemo(() => {
    if (!data?.mockAttempts) return [];
    return filterByTimeFrame(
      data.mockAttempts,
      progressMode.mode,
      progressMode.timeFrameDays,
    );
  }, [data, progressMode.mode, progressMode.timeFrameDays]);

  const sectionProgress = useMemo(() => {
    if (!data) return [];
    return computeSectionProgressFromMockAttempts(
      data.mockAttempts,
      data.setAttempts,
      data.sectionProgress,
      progressMode.mode,
      progressMode.timeFrameDays,
    );
  }, [data, progressMode.mode, progressMode.timeFrameDays]);

  const sharedDateRange = useMemo(() => {
    return getSharedDateRange(
      [],
      [],
      filteredMockAttempts,
      progressMode.mode,
      progressMode.timeFrameDays,
    );
  }, [filteredMockAttempts, progressMode.mode, progressMode.timeFrameDays]);

  const averageMockScore = useMemo(() => {
    const withScore = filteredMockAttempts.filter(
      (a) => a.scaledScore != null && a.scaledScore > 0,
    );
    if (withScore.length === 0) return null;
    const sum = withScore.reduce((s, a) => s + (a.scaledScore ?? 0), 0);
    return Math.round(sum / withScore.length);
  }, [filteredMockAttempts]);

  const mocksCompleted = useMemo(() => {
    const uniqueMockIds = new Set(
      filteredMockAttempts.map((a) => a.ucatMockId),
    );
    return uniqueMockIds.size;
  }, [filteredMockAttempts]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock progress"
          description="Loading your mock progress..."
        />
        <div className="animate-pulse space-y-6">
          <div className="h-32 w-64 mx-auto rounded-xl bg-muted" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    );
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

      <ProgressModeSelector
        mode={progressMode.mode}
        onModeChange={progressMode.onModeChange}
        timeFrameDays={progressMode.timeFrameDays}
        onTimeFrameDaysChange={progressMode.onTimeFrameDaysChange}
        showAttemptFilter={false}
      />

      <div className="flex flex-wrap justify-center gap-4">
        <Card className="w-full max-w-xs rounded-xl border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-center">
              Average mock score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-4xl font-bold tabular-nums text-center ${
                averageMockScore == null ? "text-muted-foreground" : ""
              }`}
            >
              {averageMockScore != null ? averageMockScore : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="w-full max-w-xs rounded-xl border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-center">
              Mocks completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold tabular-nums text-center">
              {mocksCompleted}
              {data.totalPublicMocks != null
                ? ` / ${data.totalPublicMocks}`
                : ""}
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionProgressCards
        sections={sectionProgress}
        linkToSection
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
      />

      <MockAttemptsCard
        attempts={data.mockAttempts}
        mode={progressMode.mode}
        timeFrameDays={progressMode.timeFrameDays}
        sharedDateRange={sharedDateRange}
      />
    </div>
  );
}
