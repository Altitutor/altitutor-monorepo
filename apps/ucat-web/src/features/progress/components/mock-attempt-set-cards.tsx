"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UcatHoverChevron } from "@/lib/ucat-hover-chevron";
import {
  UCAT_CARD_CHROME,
  UCAT_CARD_RAISED_HOVER,
  UCAT_DIVIDER_TOP,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type {
  MockAttemptDetailResponse,
  MockSetInfo,
} from "@/app/api/ucat/progress/mock-attempts/[id]/route";
import { computeCategoryBreakdown } from "../lib/compute-category-breakdown";
import {
  AnimatedFraction,
  AnimatedInteger,
  ProgressCircular,
} from "./progress-animated-display";

type MockAttemptSetCardsProps = {
  sets: MockSetInfo[];
  mockAttemptId: string;
  questionAttempts: MockAttemptDetailResponse["questionAttempts"];
};

export function MockAttemptSetCards({
  sets,
  mockAttemptId,
  questionAttempts,
}: MockAttemptSetCardsProps) {
  if (sets.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sets.map((set, setIndex) => {
        const points = set.scorePoints ?? 0;
        const total = set.totalPoints ?? 0;
        const percentage =
          total > 0 ? Math.round((points / total) * 100) : 0;
        const setAttempts = questionAttempts.filter(
          (q) => q.setIndex === setIndex,
        );
        const categoryBreakdown = computeCategoryBreakdown(setAttempts);
        const href = set.setAttemptId
          ? `/progress/mock-attempts/${mockAttemptId}/sets/${set.setAttemptId}`
          : null;

        const card = (
          <Card
            className={cn(
              UCAT_CARD_CHROME,
              href != null && UCAT_CARD_RAISED_HOVER,
              "h-full",
            )}
          >
            <CardHeader
              className={cn("pb-2", href != null && "relative space-y-0 pr-12")}
            >
              <CardTitle className="text-base font-medium">
                {set.questionSetName ?? "Set"}
              </CardTitle>
              {href != null ? (
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center sm:right-3">
                  <UcatHoverChevron className="h-4 w-4" />
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {set.scaledScore != null ? (
                <div className="flex flex-col gap-1">
                  <div className="text-base font-medium text-muted-foreground">
                    Scaled score
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    <AnimatedInteger value={Math.round(set.scaledScore)} />
                  </span>
                </div>
              ) : null}
              <div className="flex flex-row items-center justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="text-base font-medium text-muted-foreground">
                    Questions correct
                  </div>
                  <span className="text-2xl font-bold tabular-nums">
                    {total > 0 ? (
                      <AnimatedFraction numerator={points} denominator={total} />
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <ProgressCircular
                  percentage={total > 0 ? percentage : 0}
                  size={48}
                  className="shrink-0 text-accent"
                />
              </div>
              {categoryBreakdown.length > 0 ? (
                <div className={cn(UCAT_DIVIDER_TOP, "pt-3")}>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Category breakdown
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {categoryBreakdown.map((cat) => (
                      <div
                        key={cat.name}
                        className="flex justify-between gap-2 text-sm tabular-nums"
                      >
                        <span className="mr-2 truncate text-muted-foreground">
                          {cat.name}
                        </span>
                        <span className="shrink-0">
                          {cat.total > 0 ? (
                            <AnimatedFraction
                              numerator={cat.score}
                              denominator={cat.total}
                            />
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );

        if (href == null) {
          return <div key={set.questionSetId}>{card}</div>;
        }

        return (
          <Link
            key={set.setAttemptId}
            href={href}
            className="group block"
            aria-label={`View ${set.questionSetName ?? "set"} progress`}
          >
            {card}
          </Link>
        );
      })}
    </div>
  );
}
