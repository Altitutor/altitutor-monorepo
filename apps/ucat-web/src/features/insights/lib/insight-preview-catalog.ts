import { buildDashboardPlanInsight } from "@/features/dashboard/lib/dashboard-plan-insight";
import { DASHBOARD_PLAN_INSIGHT_PREVIEW_CASES } from "@/features/dashboard/lib/dashboard-plan-insight.preview";
import { buildDashboardTrajectoryInsight } from "@/features/dashboard/lib/dashboard-trajectory-insight";
import { DASHBOARD_TRAJECTORY_INSIGHT_PREVIEW_CASES } from "@/features/dashboard/lib/dashboard-trajectory-insight.preview";
import type {
  InsightPreviewCase,
  ResolvedInsightPreview,
} from "@/features/insights/model/insight-preview";
import {
  buildAttemptOverallInsight,
  buildQuestionAttemptInsight,
} from "@/features/progress/lib/attempt-insights";
import {
  ATTEMPT_INSIGHT_PREVIEW_CASES,
  QUESTION_INSIGHT_PREVIEW_CASES,
} from "@/features/progress/lib/attempt-insights.preview";
import { buildMockTrajectoryInsight } from "@/features/progress/lib/mock-trajectory-insight";
import { MOCK_TRAJECTORY_INSIGHT_PREVIEW_CASES } from "@/features/progress/lib/mock-trajectory-insight.preview";
import {
  buildSectionScoreInsight,
  buildTotalScoreInsight,
} from "@/features/progress/lib/score-insights";
import {
  SECTION_SCORE_INSIGHT_PREVIEW_CASES,
  TOTAL_SCORE_INSIGHT_PREVIEW_CASES,
} from "@/features/progress/lib/score-insights.preview";
import { buildSectionTimingInsight } from "@/features/progress/lib/section-timing-insight";
import { SECTION_TIMING_INSIGHT_PREVIEW_CASES } from "@/features/progress/lib/section-timing-insight.preview";

type PreviewDecision = {
  ruleId: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  tone?: string;
};

function resolveCases<Input>({
  family,
  contextHref,
  cases,
  evaluate,
}: {
  family: string;
  contextHref: string;
  cases: ReadonlyArray<InsightPreviewCase<Input>>;
  evaluate: (input: Input) => PreviewDecision;
}): ResolvedInsightPreview[] {
  return cases.map((previewCase) => {
    const decision = evaluate(previewCase.input);
    if (decision.ruleId !== previewCase.expectedRuleId) {
      throw new Error(
        `Insight preview case ${previewCase.label} expected ${previewCase.expectedRuleId}, received ${decision.ruleId}`,
      );
    }
    return {
      family,
      label: previewCase.label,
      condition: previewCase.condition,
      ruleId: decision.ruleId,
      title: decision.title,
      body: decision.body,
      input: previewCase.input,
      contextHref,
      actionLabel: decision.actionLabel,
      actionHref: decision.actionHref,
      tone: decision.tone,
    };
  });
}

export const INSIGHT_PREVIEW_CATALOG: ResolvedInsightPreview[] = [
  ...resolveCases({
    family: "Dashboard setup",
    contextHref: "/dashboard/preview?scenario=no_plan",
    cases: DASHBOARD_PLAN_INSIGHT_PREVIEW_CASES,
    evaluate: buildDashboardPlanInsight,
  }),
  ...resolveCases({
    family: "Dashboard trajectory",
    contextHref: "/dashboard/preview",
    cases: DASHBOARD_TRAJECTORY_INSIGHT_PREVIEW_CASES,
    evaluate: buildDashboardTrajectoryInsight,
  }),
  ...resolveCases({
    family: "Total score",
    contextHref: "/progress/preview?surface=overview",
    cases: TOTAL_SCORE_INSIGHT_PREVIEW_CASES,
    evaluate: buildTotalScoreInsight,
  }),
  ...resolveCases({
    family: "Section score",
    contextHref: "/progress/preview?surface=section_2",
    cases: SECTION_SCORE_INSIGHT_PREVIEW_CASES,
    evaluate: buildSectionScoreInsight,
  }),
  ...resolveCases({
    family: "Section timing",
    contextHref: "/progress/preview?surface=section_2",
    cases: SECTION_TIMING_INSIGHT_PREVIEW_CASES,
    evaluate: buildSectionTimingInsight,
  }),
  ...resolveCases({
    family: "Mock trajectory",
    contextHref: "/progress/mocks",
    cases: MOCK_TRAJECTORY_INSIGHT_PREVIEW_CASES,
    evaluate: buildMockTrajectoryInsight,
  }),
  ...resolveCases({
    family: "Attempt",
    contextHref: "/progress/attempts/preview",
    cases: ATTEMPT_INSIGHT_PREVIEW_CASES,
    evaluate: buildAttemptOverallInsight,
  }),
  ...resolveCases({
    family: "Question",
    contextHref: "/progress/attempts/preview",
    cases: QUESTION_INSIGHT_PREVIEW_CASES,
    evaluate: buildQuestionAttemptInsight,
  }),
];
