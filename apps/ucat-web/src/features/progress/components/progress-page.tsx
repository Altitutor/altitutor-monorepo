"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { AppPageSkeleton } from "@/features/layout/components/app-page-skeleton";
import { useProgressSummary } from "../hooks/use-progress";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { SectionProgressCards } from "./section-progress-cards";
import { ReviewHeatmapCard } from "./review-heatmap-card";
import { PercentileCard } from "./percentile-card";
import { PredictedScoreCard } from "./predicted-score-card";

const COGNITIVE_SECTION_LABELS: Record<number, string> = {
  1: "Verbal Reasoning",
  2: "Decision Making",
  3: "Quantitative Reasoning",
};

export function ProgressPage() {
  const { data, isLoading, error } = useProgressSummary();
  const scoreProjectionQuery = useScoreProjection();
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  const totalProjection = useMemo(() => {
    if (!scoreProjectionQuery.data) return null;
    return deriveTotalScoreProjection(scoreProjectionQuery.data.sections);
  }, [scoreProjectionQuery.data]);

  const predictedScore = totalProjection?.currentEstimate ?? null;
  const emptyMessage = useMemo(() => {
    if (totalProjection == null || totalProjection.currentEstimate != null) {
      return undefined;
    }
    const missingSections = totalProjection.missingSectionNumbers
      .map((sectionNumber) => COGNITIVE_SECTION_LABELS[sectionNumber])
      .filter(Boolean)
      .join(", ");
    if (missingSections.length === 0) {
      return "Complete more timed sets or mocks for a prediction.";
    }
    return `Complete enough timed sets or mocks in ${missingSections} for a total score prediction.`;
  }, [totalProjection]);

  if (isLoading) {
    return <AppPageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
          description="Could not load your progress."
        />
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <UcatPageHeader
          title="Progress"
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
      <motion.div id="tour-progress-header" variants={itemVariants}>
        <UcatPageHeader
          title="Progress"
          description="A summary of your performance across UCAT sections."
        />
      </motion.div>

      <motion.div
        className="grid gap-4 lg:grid-cols-2"
        variants={itemVariants}
      >
        <PredictedScoreCard
          title="Predicted UCAT score"
          tooltip="Predicted UCAT score is the sum of your predicted Verbal Reasoning, Decision Making, and Quantitative Reasoning scores. Situational Judgement is excluded."
          score={predictedScore}
          projection={totalProjection}
          emptyMessage={emptyMessage}
          yAxisDomain={[900, 2700]}
        />
        <PercentileCard scaledScore={predictedScore} scope="mock" />
      </motion.div>

      <motion.div variants={itemVariants}>
        <ReviewHeatmapCard />
      </motion.div>

      <motion.div id="tour-progress-sections" variants={itemVariants}>
        <SectionProgressCards
          sections={data.sectionProgress}
          linkToSection
          mode="all_time"
          timeFrameDays="30"
          scoreProjections={scoreProjectionQuery.data?.sections ?? []}
        />
      </motion.div>
    </motion.div>
  );
}
