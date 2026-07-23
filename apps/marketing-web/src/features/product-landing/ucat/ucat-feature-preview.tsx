import type { UcatFeatureSlug } from "./ucat-feature-data";
import { UcatAttemptReviewPreview } from "./ucat-attempt-review-preview";
import { UcatLearningPreview } from "./ucat-learning-preview";
import { UcatPracticeSuitePreview } from "./ucat-practice-suite-preview";
import { UcatProgressPlanPreview } from "./ucat-progress-plan-preview";

export function UcatFeaturePreview({ slug }: { slug: UcatFeatureSlug }) {
  if (slug === "practice-and-simulation") return <UcatPracticeSuitePreview />;
  if (slug === "review-and-analytics") return <UcatAttemptReviewPreview />;
  if (slug === "guided-learning") return <UcatLearningPreview />;
  return <UcatProgressPlanPreview />;
}
