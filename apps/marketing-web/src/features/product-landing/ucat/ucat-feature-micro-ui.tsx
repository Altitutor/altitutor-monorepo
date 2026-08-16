"use client";

import type {
  FeatureCardPreviewId,
  FeatureDetailPreviewId,
} from "./ucat-feature-data";
import {
  MarketingExamCalculator,
  MarketingKeyboardShortcutsPreview,
  MarketingLearnGuidedWalkthroughPreview,
  MarketingLearnRemediationDirectoryPreview,
  MarketingLearnSectionDirectoryPreview,
  MarketingLearnWorkedExamplePreview,
  MarketingPracticeDiscountPreview,
  MarketingPracticePacePreview,
  MarketingPracticeSectionCard,
  MarketingProgressScoreInsightPreview,
  MarketingProgressScoreTrackingPreview,
  MarketingReviewExplanationDmPreview,
  MarketingReviewTimingInteractivePreview,
  MarketingSectionStrengthsPreview,
  MarketingSimulatorDetailPreview,
  MarketingFindWordTrainerPreview,
  MarketingStudyOrbPreview,
  MarketingStudyPlanCardSnapshot,
  MarketingStudyPlanInsightsPreview,
  MarketingStudyPlanSetupPreview,
} from "./ucat-feature-detail-previews";
import {
  MarketingProgressCardSnapshot,
  MarketingSimulatorBleedPreview,
} from "./ucat-marketing-faithful-ui";
import { useFaithfulMotion } from "./ucat-marketing-faithful-ui-motion";
import { UcatLearningCardPreview } from "./ucat-learning-card-preview";

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
          ? "ucat-product-ui pointer-events-auto w-full min-w-0 max-w-full text-[#1a1a1a]"
          : "ucat-product-ui pointer-events-none w-full min-w-0 max-w-full select-none text-[#1a1a1a]"
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
    case "study-plan-snapshot":
      return <MarketingStudyPlanCardSnapshot animate={animate} />;
    case "learning-module-snapshot":
      return <UcatLearningCardPreview animate={animate} />;
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
    case "practice-simulator":
      return <MarketingSimulatorDetailPreview />;
    case "practice-calculator":
      return <MarketingExamCalculator animate={animate} />;
    case "practice-keyboard-shortcuts":
      return <MarketingKeyboardShortcutsPreview animate={animate} />;
    case "practice-filters":
      return <MarketingPracticeSectionCard animate={animate} />;
    case "practice-pace":
      return <MarketingPracticePacePreview animate={animate} />;
    case "practice-skill-trainer":
      return <MarketingFindWordTrainerPreview animate={animate} />;
    case "study-plan-calendar":
      return <MarketingStudyPlanCardSnapshot animate={animate} />;
    case "study-plan-target-score":
      return <MarketingProgressScoreTrackingPreview animate={animate} />;
    case "study-plan-setup":
      return <MarketingStudyPlanSetupPreview animate={animate} />;
    case "study-plan-orb":
      return <MarketingStudyOrbPreview animate={animate} />;
    case "study-plan-insights":
      return <MarketingStudyPlanInsightsPreview animate={animate} />;
    case "learn-section-directory":
      return <MarketingLearnSectionDirectoryPreview animate={animate} />;
    case "learn-worked-example":
      return <MarketingLearnWorkedExamplePreview animate={animate} />;
    case "learn-guided-walkthrough":
      return <MarketingLearnGuidedWalkthroughPreview animate={animate} />;
    case "learn-remediation-directory":
      return <MarketingLearnRemediationDirectoryPreview animate={animate} />;
    case "progress-practice-discounts":
      return <MarketingPracticeDiscountPreview animate={animate} />;
    case "progress-section-strengths":
      return <MarketingSectionStrengthsPreview animate={animate} />;
    case "review-explanation-dm":
      return <MarketingReviewExplanationDmPreview animate={animate} />;
    case "review-timing-interactive":
      return <MarketingReviewTimingInteractivePreview animate={animate} />;
    case "progress-score-tracking":
      return <MarketingProgressScoreTrackingPreview animate={animate} />;
    case "progress-score-insight":
      return <MarketingProgressScoreInsightPreview animate={animate} />;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}

export function UcatFeatureCardPreview({ id }: { id: FeatureCardPreviewId }) {
  const interactive = id === "progress-plan-snapshot";

  return (
    <FaithfulPreview interactive={interactive}>
      <CardPreview id={id} />
    </FaithfulPreview>
  );
}

export function UcatFeatureDetailPreview({ id }: { id: FeatureDetailPreviewId }) {
  const interactive = id === "practice-calculator";

  return (
    <FaithfulPreview interactive={interactive}>
      <DetailPreview id={id} />
    </FaithfulPreview>
  );
}
