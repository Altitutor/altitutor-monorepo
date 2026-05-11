"use client";

import Link from "next/link";
import { UcatPageHeader } from "@/features/layout";
import { useMockAttemptDetail } from "../hooks/use-mock-attempt-detail";
import { MockAttemptAnalysisChart } from "./mock-attempt-analysis-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_RAISED_HOVER } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type MockAttemptDetailPageProps = {
  mockAttemptId: string;
};

export function MockAttemptDetailPage({
  mockAttemptId,
}: MockAttemptDetailPageProps) {
  const { data, isLoading, error } = useMockAttemptDetail(mockAttemptId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Loading..."
          backHref="/progress"
          backLabel="Back to progress"
        />
        <div className="animate-pulse space-y-6">
          <div className="h-32 rounded-lg bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock attempt"
          description="Could not load mock attempt."
          backHref="/progress"
          backLabel="Back to progress"
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Mock attempt"
          description="No data available."
          backHref="/progress"
          backLabel="Back to progress"
        />
      </div>
    );
  }

  const attemptedDate = new Date(data.attemptedAt).toLocaleDateString();

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <UcatPageHeader
        title={data.mockName ?? "Mock attempt"}
        description={`Attempted ${attemptedDate}`}
        backHref="/progress"
        backLabel="Back to progress"
        breadcrumbOverrides={{ 2: data.mockName ?? "Mock" }}
      />

      <Card className="rounded-xl border-border max-w-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Overall scaled score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              data.scaledScore == null && "text-muted-foreground",
            )}
          >
            {data.scaledScore != null && data.scaledScoreMax != null
              ? `${Math.round(data.scaledScore)} / ${data.scaledScoreMax}`
              : data.scaledScore != null
                ? String(Math.round(data.scaledScore))
                : "—"}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Question attempts
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          <MockAttemptAnalysisChart
            data={data.questionAttempts.map((q) => ({
              questionNumber: q.questionNumber,
              timeSpentSeconds: q.timeSpentSeconds,
              result: q.result,
            }))}
            setBoundaryIndices={data.setBoundaryIndices}
            sets={data.sets.map((s) => ({
              questionSetName: s.questionSetName,
            }))}
          />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Sets</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.sets.map((set) => {
            const total = set.totalPoints ?? 0;
            const points = set.scorePoints ?? 0;
            const href = set.setAttemptId
              ? `/progress/mock-attempts/${mockAttemptId}/sets/${set.setAttemptId}`
              : null;

            const content = (
              <Card
                className={cn(
                  "rounded-xl border-border",
                  href && cn("cursor-pointer", UCAT_CARD_RAISED_HOVER),
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">
                    {set.questionSetName ?? "Set"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Points
                    </div>
                    <div className="text-xl font-semibold tabular-nums">
                      {total > 0 ? `${points} / ${total}` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Scaled score
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        set.scaledScore == null && "text-muted-foreground",
                      )}
                    >
                      {set.scaledScore != null
                        ? `${Math.round(set.scaledScore)} / 900`
                        : "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            if (href) {
              return (
                <Link key={set.setAttemptId || set.questionSetId} href={href}>
                  {content}
                </Link>
              );
            }

            return (
              <div key={set.setAttemptId || set.questionSetId}>{content}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
