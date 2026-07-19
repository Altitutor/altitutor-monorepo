"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@altitutor/ui";
import type {
  SectionCategoryProgress,
  SectionProgress,
} from "@altitutor/shared";
import type { UcatActivityResponse } from "@/app/api/ucat/activity/route";
import type { ProgressAttemptRow } from "@/app/api/ucat/progress/attempts/route";
import type {
  DailyProgressSeriesPoint,
  ProgressSeriesSource,
} from "@/app/api/ucat/progress/series/route";
import { Button } from "@/components/ui/button";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import type {
  ProjectionConfidence,
  SectionScoreProjection,
} from "@/features/score-projection/types/score-projection";
import { addDays, todayIso } from "@/features/study-plan/lib/dates";
import type { AttemptHistoryPreviewData } from "./attempt-history-explorer";
import { ProgressPageContent } from "./progress-page";
import { SectionProgressContent } from "./section-progress-page";

type PreviewSurface = "overview" | "section_1" | "section_2" | "section_3" | "section_4";
type PreviewScenarioId =
  | "baseline"
  | "early_estimate"
  | "on_track"
  | "needs_focus"
  | "no_target";

type PreviewScenario = {
  id: PreviewScenarioId;
  label: string;
  description: string;
  confidence: ProjectionConfidence;
  baseScore: number | null;
  targetScore: number | null;
  accuracy: number;
  completedQuestions: number;
  completedSets: number;
  evidenceCount: number;
  averageExamSpeed: number | null;
};

type SectionDefinition = {
  id: string;
  name: string;
  number: number;
  scoreOffset: number;
  totalQuestions: number;
  totalSets: number;
  categoryNames: string[];
};

const SURFACES: Array<{ value: PreviewSurface; label: string }> = [
  { value: "overview", label: "Progress overview" },
  { value: "section_1", label: "Verbal Reasoning" },
  { value: "section_2", label: "Decision Making" },
  { value: "section_3", label: "Quantitative Reasoning" },
  { value: "section_4", label: "Situational Judgement" },
];

const SCENARIOS: PreviewScenario[] = [
  {
    id: "baseline",
    label: "Building baseline",
    description: "No reliable score yet, no attempts, and empty supporting evidence.",
    confidence: "low",
    baseScore: null,
    targetScore: 720,
    accuracy: 0,
    completedQuestions: 0,
    completedSets: 0,
    evidenceCount: 0,
    averageExamSpeed: null,
  },
  {
    id: "early_estimate",
    label: "Early estimate",
    description: "Sparse evidence, a wide forecast, and only a few recent attempts.",
    confidence: "low",
    baseScore: 525,
    targetScore: 720,
    accuracy: 44,
    completedQuestions: 18,
    completedSets: 1,
    evidenceCount: 2,
    averageExamSpeed: 82,
  },
  {
    id: "on_track",
    label: "On track",
    description: "Strong evidence, balanced accuracy, and an estimate at the target.",
    confidence: "high",
    baseScore: 735,
    targetScore: 720,
    accuracy: 78,
    completedQuestions: 96,
    completedSets: 6,
    evidenceCount: 12,
    averageExamSpeed: 108,
  },
  {
    id: "needs_focus",
    label: "Needs focus",
    description: "A meaningful score gap with one clearly weaker category.",
    confidence: "medium",
    baseScore: 585,
    targetScore: 750,
    accuracy: 51,
    completedQuestions: 62,
    completedSets: 4,
    evidenceCount: 7,
    averageExamSpeed: 91,
  },
  {
    id: "no_target",
    label: "No target or test date",
    description: "A stable estimate without a configured score target or exact test date.",
    confidence: "medium",
    baseScore: 650,
    targetScore: null,
    accuracy: 66,
    completedQuestions: 74,
    completedSets: 5,
    evidenceCount: 8,
    averageExamSpeed: 102,
  },
];

const SECTIONS: SectionDefinition[] = [
  {
    id: "preview-vr",
    name: "Verbal Reasoning",
    number: 1,
    scoreOffset: -15,
    totalQuestions: 165,
    totalSets: 7,
    categoryNames: ["Reading Comprehension", "True, False, Can't Tell"],
  },
  {
    id: "preview-dm",
    name: "Decision Making",
    number: 2,
    scoreOffset: 10,
    totalQuestions: 142,
    totalSets: 6,
    categoryNames: ["Syllogisms", "Logic Puzzles", "Probability", "Venn Diagrams"],
  },
  {
    id: "preview-qr",
    name: "Quantitative Reasoning",
    number: 3,
    scoreOffset: 25,
    totalQuestions: 128,
    totalSets: 6,
    categoryNames: ["Arithmetic", "Ratios", "Data Interpretation"],
  },
  {
    id: "preview-sjt",
    name: "Situational Judgement",
    number: 4,
    scoreOffset: -25,
    totalQuestions: 154,
    totalSets: 5,
    categoryNames: ["Appropriateness", "Importance"],
  },
];

function clampSectionScore(score: number): number {
  return Math.max(300, Math.min(900, Math.round(score)));
}

function makeSectionProjection(
  section: SectionDefinition,
  scenario: PreviewScenario,
  today: string,
): SectionScoreProjection {
  const currentEstimate =
    scenario.baseScore == null
      ? null
      : clampSectionScore(scenario.baseScore + section.scoreOffset);
  const uncertainty =
    scenario.confidence === "low"
      ? 85
      : scenario.confidence === "medium"
        ? 48
        : 28;
  const history =
    currentEstimate == null
      ? []
      : [-60, -40, -20, 0].map((day, index) => ({
          date: addDays(today, day),
          value: clampSectionScore(currentEstimate - (3 - index) * 18),
          confidence: index === 0 ? ("low" as const) : scenario.confidence,
          uncertainty: uncertainty + (3 - index) * 12,
          effectiveEvidenceWeight: Math.max(1, scenario.evidenceCount - 3 + index),
        }));
  const projection =
    currentEstimate == null
      ? []
      : [0, 30, 60, 90, 120].map((day) => ({
          day,
          date: addDays(today, day),
          pessimistic: clampSectionScore(currentEstimate + day * 0.25 - uncertainty),
          realistic: clampSectionScore(currentEstimate + day * 0.55),
          optimistic: clampSectionScore(currentEstimate + day * 0.8 + uncertainty),
        }));

  return {
    sectionId: section.id,
    sectionName: section.name,
    sectionNumber: section.number,
    currentEstimate,
    confidence: scenario.confidence,
    uncertainty,
    effectiveEvidenceWeight: scenario.evidenceCount,
    evidenceCount: scenario.evidenceCount,
    paceSource: scenario.evidenceCount > 0 ? "recent_activity" : "default",
    effectivePracticePerWeek: scenario.evidenceCount > 0 ? 75 : 0,
    history,
    projection,
    horizons: projection
      .filter((point) => point.day > 0)
      .map(({ day, pessimistic, realistic, optimistic }) => ({
        day,
        pessimistic,
        realistic,
        optimistic,
      })),
  };
}

function makeCategoryProgress(
  section: SectionDefinition,
  scenario: PreviewScenario,
): SectionCategoryProgress[] {
  if (scenario.completedQuestions === 0) return [];
  const completedBase = Math.floor(
    scenario.completedQuestions / section.categoryNames.length,
  );
  const accuracyOffsets = scenario.id === "needs_focus" ? [-22, 8, 4, 10] : [-6, 5, 2, 7];

  return section.categoryNames.map((categoryName, index) => {
    const maxScore =
      completedBase +
      (index < scenario.completedQuestions % section.categoryNames.length ? 1 : 0);
    const percentage = Math.max(
      0,
      Math.min(100, scenario.accuracy + (accuracyOffsets[index] ?? 0)),
    );
    return {
      categoryId: `${section.id}-category-${index}`,
      categoryName,
      correctScore: Math.round((maxScore * percentage) / 100),
      maxScore,
      percentage,
      totalPublicQuestions: Math.round(
        section.totalQuestions / section.categoryNames.length,
      ),
    };
  });
}

function makeSectionProgress(
  section: SectionDefinition,
  scenario: PreviewScenario,
): SectionProgress {
  const correctScore = Math.round(
    (scenario.completedQuestions * scenario.accuracy) / 100,
  );
  return {
    sectionId: section.id,
    sectionName: section.name,
    sectionNumber: section.number,
    correctScore,
    maxScore: scenario.completedQuestions,
    percentage: scenario.completedQuestions > 0 ? scenario.accuracy : 0,
    totalPublicQuestions: section.totalQuestions,
  };
}

function makeSeriesPoint(
  date: string,
  source: ProgressSeriesSource,
  score: number,
  accuracy: number,
  index: number,
): DailyProgressSeriesPoint {
  const scaledScore = clampSectionScore(score - 35 + index * 14);
  const totalPoints = source === "practice" ? 18 : 30;
  const scorePoints = Math.round((totalPoints * Math.min(95, accuracy + index * 2)) / 100);
  const timeTakenSeconds = source === "practice" ? 720 + index * 25 : 1050 - index * 20;
  const timeLimitSeconds = source === "practice" ? 900 : 1100;
  return {
    date,
    attemptCount: 1,
    scaledScoreSum: source === "practice" ? 0 : scaledScore,
    scaledScoreCount: source === "practice" ? 0 : 1,
    scorePointsSum: scorePoints,
    totalPointsSum: totalPoints,
    timeTakenSecondsSum: timeTakenSeconds,
    timeTakenCount: 1,
    timeLimitSecondsSum: timeLimitSeconds,
    examSpeedPercentSum: (timeLimitSeconds / timeTakenSeconds) * 100,
    examSpeedCount: source === "practice" ? 0 : 1,
  };
}

function makeAttempt(
  source: ProgressSeriesSource,
  section: SectionDefinition,
  date: string,
  score: number,
  accuracy: number,
  index: number,
): ProgressAttemptRow {
  const completedAt = `${date}T09:30:00.000Z`;
  if (source === "practice") {
    return {
      source,
      id: `preview-practice-${section.number}-${index}`,
      attemptedAt: completedAt,
      completedAt,
      ucatSectionId: section.id,
      sectionName: section.name,
      scorePoints: Math.round((18 * Math.min(95, accuracy + index * 2)) / 100),
      totalPoints: 18,
      questionCount: 18,
      timeTakenSeconds: 720 + index * 25,
      unlimited: index % 2 === 0,
    };
  }
  if (source === "set") {
    return {
      source,
      id: `preview-set-${section.number}-${index}`,
      attemptedAt: completedAt,
      completedAt,
      questionSetId: `preview-set-${index}`,
      questionSetName: `${section.name} set ${index + 1}`,
      studentUcatMockAttemptId: null,
      scorePoints: Math.round((30 * Math.min(95, accuracy + index * 2)) / 100),
      totalPoints: 30,
      scaledScore: clampSectionScore(score - 35 + index * 14),
      timeTakenSeconds: 1050 - index * 20,
      setTimeLimitSeconds: 1100,
      studentSetSpeed: 1.04,
      studentExamSpeed: 1.04,
      wasTimed: true,
      sectionId: section.id,
    };
  }
  return {
    source,
    id: `preview-mock-${section.number}-${index}`,
    attemptedAt: completedAt,
    completedAt,
    ucatMockId: `preview-mock-${index}`,
    mockName: `Full mock ${index + 1}`,
    scorePoints: Math.round((30 * Math.min(95, accuracy + index * 2)) / 100),
    totalPoints: 30,
    scaledScore: clampSectionScore(score - 25 + index * 12),
    scaledScoreMax: 900,
    timeTakenSeconds: 6300 - index * 45,
    setTimeLimitSeconds: 6600,
    studentSetSpeed: 1.05,
    studentExamSpeed: 1.05,
    wasTimed: true,
  };
}

function makeAttemptHistory(
  section: SectionDefinition,
  scenario: PreviewScenario,
  score: number | null,
  today: string,
): Record<ProgressSeriesSource, AttemptHistoryPreviewData> {
  const offsets = scenario.evidenceCount === 0 ? [] : [-54, -37, -24, -14, -7, -2];
  const sources: ProgressSeriesSource[] = ["practice", "set", "mock"];
  return Object.fromEntries(
    sources.map((source) => {
      const attempts = offsets.map((offset, index) =>
        makeAttempt(
          source,
          section,
          addDays(today, offset),
          score ?? 500,
          scenario.accuracy,
          index,
        ),
      );
      const series = offsets.map((offset, index) =>
        makeSeriesPoint(
          addDays(today, offset),
          source,
          score ?? 500,
          scenario.accuracy,
          index,
        ),
      );
      return [source, { attempts, series }];
    }),
  ) as Record<ProgressSeriesSource, AttemptHistoryPreviewData>;
}

function makeActivity(
  today: string,
  scenario: PreviewScenario,
): UcatActivityResponse {
  if (scenario.evidenceCount === 0) {
    return {
      startedAt: null,
      timezone: "Australia/Adelaide",
      days: [],
    };
  }
  return {
    startedAt: `${addDays(today, -120)}T00:00:00.000Z`,
    timezone: "Australia/Adelaide",
    days: [-58, -44, -31, -22, -15, -9, -5, -2, 0].map(
      (offset, index) => ({
        dateKey: addDays(today, offset),
        questionAttempts: 4 + ((index * 7) % 26),
        setAttempts: index % 3 === 0 ? 1 : 0,
      }),
    ),
  };
}

function requestedSurface(): PreviewSurface {
  if (typeof window === "undefined") return "overview";
  const requested = new URLSearchParams(window.location.search).get("surface");
  return SURFACES.some((surface) => surface.value === requested)
    ? (requested as PreviewSurface)
    : "overview";
}

function requestedScenario(): PreviewScenarioId {
  if (typeof window === "undefined") return "needs_focus";
  const requested = new URLSearchParams(window.location.search).get("scenario");
  return SCENARIOS.some((scenario) => scenario.id === requested)
    ? (requested as PreviewScenarioId)
    : "needs_focus";
}

export function ProgressPreviewPage() {
  const [surface, setSurface] = useState<PreviewSurface>(requestedSurface);
  const [scenarioId, setScenarioId] =
    useState<PreviewScenarioId>(requestedScenario);
  const scenario = SCENARIOS.find((candidate) => candidate.id === scenarioId)!;
  const today = todayIso();
  const model = useMemo(() => {
    const projections = SECTIONS.map((section) =>
      makeSectionProjection(section, scenario, today),
    );
    const progress = SECTIONS.map((section) =>
      makeSectionProgress(section, scenario),
    );
    const categories = Object.fromEntries(
      SECTIONS.map((section) => [
        section.number,
        makeCategoryProgress(section, scenario),
      ]),
    ) as Record<number, SectionCategoryProgress[]>;
    const sectionTargets = Object.fromEntries(
      SECTIONS.map((section) => [section.id, scenario.targetScore]),
    ) as Record<string, number | null>;
    return {
      projections,
      progress,
      categories,
      total: deriveTotalScoreProjection(projections),
      sectionTargets,
      activity: makeActivity(today, scenario),
      attemptHistory: Object.fromEntries(
        SECTIONS.map((section) => [
          section.number,
          makeAttemptHistory(
            section,
            scenario,
            projections.find(
              (projection) => projection.sectionNumber === section.number,
            )?.currentEstimate ?? null,
            today,
          ),
        ]),
      ) as Record<number, Record<ProgressSeriesSource, AttemptHistoryPreviewData>>,
    };
  }, [scenario, today]);
  const selectedSectionNumber =
    surface === "overview" ? null : Number(surface.slice(-1));
  const selectedSection =
    selectedSectionNumber == null
      ? null
      : SECTIONS.find((section) => section.number === selectedSectionNumber)!;
  const selectedProgress = selectedSection
    ? model.progress.find(
        (section) => section.sectionNumber === selectedSection.number,
      )!
    : null;
  const selectedProjection = selectedSection
    ? model.projections.find(
        (section) => section.sectionNumber === selectedSection.number,
      )!
    : null;
  const updateUrl = (nextSurface: PreviewSurface, nextScenario: PreviewScenarioId) => {
    window.history.replaceState(
      null,
      "",
      `/progress/preview?surface=${nextSurface}&scenario=${nextScenario}`,
    );
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-5 lg:flex-row lg:items-end lg:justify-between sm:px-6">
        <div>
          <Badge variant="secondary">Development preview</Badge>
          <h1 className="mt-2 text-2xl font-semibold">Progress state lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scenario.description}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Page
            <select
              value={surface}
              onChange={(event) => {
                const next = event.target.value as PreviewSurface;
                setSurface(next);
                updateUrl(next, scenarioId);
              }}
              className="mt-1 block min-w-56 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {SURFACES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Scenario
            <select
              value={scenarioId}
              onChange={(event) => {
                const next = event.target.value as PreviewScenarioId;
                setScenarioId(next);
                updateUrl(surface, next);
              }}
              className="mt-1 block min-w-56 rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {SCENARIOS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {surface === "overview" ? (
        <ProgressPageContent
          sections={model.progress}
          scoreProjections={model.projections}
          totalProjection={model.total}
          targetScore={
            scenario.targetScore == null ? null : scenario.targetScore * 3
          }
          testDate={scenario.id === "no_target" ? null : addDays(today, 90)}
          today={today}
          sectionTargets={Object.fromEntries(
            Object.entries(model.sectionTargets).flatMap(([key, value]) =>
              value == null ? [] : [[key, value]],
            ),
          )}
          activityPreviewData={model.activity}
          linkToSections
        />
      ) : selectedSection && selectedProgress && selectedProjection ? (
        <SectionProgressContent
          section={selectedProgress}
          score={selectedProjection.currentEstimate}
          percentage={selectedProgress.percentage}
          totalPublicQuestions={selectedSection.totalQuestions}
          totalPublicSets={selectedSection.totalSets}
          totalPublicUntimedSets={2}
          totalPublicTimedSets={Math.max(0, selectedSection.totalSets - 2)}
          setsCompleted={scenario.completedSets}
          untimedSetsCompleted={Math.min(2, scenario.completedSets)}
          timedSetsCompleted={Math.max(0, scenario.completedSets - 2)}
          categoryProgress={model.categories[selectedSection.number] ?? []}
          scoreProjection={selectedProjection}
          targetScore={scenario.targetScore}
          testDate={scenario.id === "no_target" ? null : addDays(today, 90)}
          today={today}
          averageExamSpeed={scenario.averageExamSpeed}
          attemptHistoryPreviewData={model.attemptHistory[selectedSection.number]}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap gap-3 px-5 sm:px-6">
        <Button asChild>
          <Link href="/progress/attempts/preview">Open attempt state lab</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/progress">Return to live progress</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard/preview">Open dashboard state lab</Link>
        </Button>
      </div>
    </div>
  );
}
