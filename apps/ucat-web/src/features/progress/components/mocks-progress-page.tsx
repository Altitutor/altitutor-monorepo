"use client";

import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useMockProgress } from "../hooks/use-progress";
import { MockAttemptsCard } from "./mock-attempts-card";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { AnimatedInteger } from "./progress-animated-display";
import { formatUcatPercentile } from "../lib/percentiles";

export function MocksProgressPage() {
  const { data, isLoading, error } = useMockProgress();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  const averageMockScore = data?.averageScaledScore ?? null;
  const averageMockPercentile = formatUcatPercentile(averageMockScore, "mock");
  const sectionBreakdown = (data?.sections ?? []).map((section) => ({
    ...section,
    averageScore: section.averageScaledScore,
    percentile: formatUcatPercentile(section.averageScaledScore, "section"),
  }));

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
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title="Mock progress"
          description="Track your performance across mock exams."
        />
      </motion.div>

      <motion.div className="flex justify-center" variants={itemVariants}>
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
      </motion.div>

      <motion.div variants={itemVariants}>
        <MockAttemptsCard />
      </motion.div>
    </motion.div>
  );
}
