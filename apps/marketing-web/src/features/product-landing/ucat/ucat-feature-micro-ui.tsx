"use client";

import type {
  FeatureCardPreviewId,
  FeatureDetailPreviewId,
} from "./ucat-feature-data";
import {
  MarketingExamCalculator,
  MarketingLearnConceptBlock,
  MarketingLearnEmbeddedQuestion,
  MarketingLearnModuleSidebar,
  MarketingPracticeFiltersPanel,
  MarketingPracticePacingPanel,
  MarketingPracticeTimingCards,
  MarketingProgressCardSnapshot,
  MarketingProgressEstimatePanel,
  MarketingReviewExplanation,
  MarketingReviewScoreBreakdown,
  MarketingReviewScoreSnapshot,
  MarketingReviewTimingChart,
  MarketingSimulatorBleedPreview,
  MarketingSkillTrainerPanel,
  MarketingStudyPlanTasks,
  MarketingTrajectoryChart,
} from "./ucat-marketing-faithful-ui";
import { useFaithfulMotion } from "./ucat-marketing-faithful-ui-motion";

function FaithfulPreview({
  children,
  interactive = false,
}: {
  children: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <div
      className={
        interactive
          ? "ucat-product-ui pointer-events-auto text-[#1a1a1a]"
          : "ucat-product-ui pointer-events-none select-none text-[#1a1a1a]"
      }
      aria-hidden={!interactive}
    >
      {children}
    </div>
  );
}

function CardPreview({ id }: { id: FeatureCardPreviewId }) {
  const { animate } = useFaithfulMotion();

  switch (id) {
    case "practice-simulator":
      return <MarketingSimulatorBleedPreview />;
    case "review-score-snapshot":
      return <MarketingReviewScoreSnapshot animate={animate} interactive />;
    case "learning-module-snapshot":
      return <MarketingLearnModuleSidebar animate={animate} />;
    case "progress-plan-snapshot":
      return <MarketingProgressCardSnapshot animate={animate} />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

function DetailPreview({ id }: { id: FeatureDetailPreviewId }) {
  const { animate } = useFaithfulMotion();

  switch (id) {
    case "practice-filters":
      return <MarketingPracticeFiltersPanel animate={animate} />;
    case "practice-timing-toggle":
      return <MarketingPracticeTimingCards animate={animate} />;
    case "practice-access-arrangements":
      return <MarketingPracticePacingPanel animate={animate} />;
    case "practice-calculator":
      return <MarketingExamCalculator animate={animate} />;
    case "review-score-breakdown":
      return <MarketingReviewScoreBreakdown animate={animate} />;
    case "review-explanation":
      return <MarketingReviewExplanation animate={animate} />;
    case "review-timing-chart":
      return <MarketingReviewTimingChart animate={animate} />;
    case "learn-concept-block":
      return <MarketingLearnConceptBlock animate={animate} />;
    case "learn-embedded-question":
      return <MarketingLearnEmbeddedQuestion animate={animate} />;
    case "learn-skill-trainer":
      return <MarketingSkillTrainerPanel animate={animate} />;
    case "progress-estimate-gauge":
      return <MarketingProgressEstimatePanel animate={animate} />;
    case "progress-trajectory":
      return <MarketingTrajectoryChart animate={animate} heightClass="h-48 sm:h-56" />;
    case "progress-plan-tasks":
      return <MarketingStudyPlanTasks animate={animate} />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function UcatFeatureCardPreview({ id }: { id: FeatureCardPreviewId }) {
  const interactive = id === "review-score-snapshot";

  return (
    <FaithfulPreview interactive={interactive}>
      <CardPreview id={id} />
    </FaithfulPreview>
  );
}

export function UcatFeatureDetailPreview({ id }: { id: FeatureDetailPreviewId }) {
  return (
    <FaithfulPreview>
      <DetailPreview id={id} />
    </FaithfulPreview>
  );
}
