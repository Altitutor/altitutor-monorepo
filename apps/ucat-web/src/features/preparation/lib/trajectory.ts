import type {
  PreparationCurrentScoreEstimate,
  PreparationEngineInput,
  PreparationTrajectory,
} from "@/features/preparation/model/types";
import { addDays } from "@/features/study-plan/lib/dates";

const MAX_TOTAL_SCORE = 2700;
const HORIZON_DAYS = 120;
const STEP_DAYS = 7;
const HALF_SATURATION_SECTION_EQUIVALENTS = 12;
const NORMAL_QUANTILE_SAMPLES = [
  -1.593, -0.967, -0.589, -0.282, 0, 0.282, 0.589, 0.967, 1.593,
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 900, MAX_TOTAL_SCORE) / 10) * 10;
}

function roundSectionScore(value: number): number {
  return Math.round(clamp(value, 300, 900) / 10) * 10;
}

const OBSERVED_BEHAVIOR_ROOM_FRACTION = 0.42;

function responseAtDose(dose: number): number {
  return (
    1 -
    Math.exp(
      (-Math.log(2) * Math.max(0, dose)) / HALF_SATURATION_SECTION_EQUIVALENTS,
    )
  );
}

function empiricalQuantile(values: number[], percentile: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.round((ordered.length - 1) * percentile)]!;
}

export function buildPreparationTrajectory(input: {
  today: string;
  modelVersion: string;
  currentScore: PreparationCurrentScoreEstimate;
  forecast?: PreparationEngineInput["evidence"]["forecast"];
}): PreparationTrajectory {
  const { currentScore, modelVersion } = input;
  const history = (input.forecast?.history ?? []).filter(
    (point) => point.modelVersion === modelVersion,
  );
  if (
    currentScore.status !== "available" ||
    currentScore.currentEstimate == null
  ) {
    return {
      status: "unavailable",
      reason: "insufficient_score_evidence",
      modelVersion,
      history,
      points: [],
    };
  }

  const recentDose = Math.max(
    0,
    input.forecast?.recentCoreSectionEquivalentsPerWeek ?? 0,
  );
  const dose = recentDose;
  const recentDoseBySection =
    input.forecast?.recentCoreSectionEquivalentsPerWeekBySection ?? {};
  const plannedDoseBySection: Record<string, number> = {};
  const sectionIds = new Set(Object.keys(recentDoseBySection));
  const effectiveDoseBySection = Object.fromEntries(
    [...sectionIds].map((sectionId) => {
      const recent = Math.max(0, recentDoseBySection[sectionId] ?? 0);
      return [sectionId, recent];
    }),
  );
  if (dose <= 0) {
    return {
      status: "unavailable",
      reason: "no_future_dose",
      modelVersion,
      history,
      points: [],
    };
  }

  const learningResponse = clamp(
    input.forecast?.learningResponse ?? 1,
    0.4,
    1.6,
  );
  const responseUncertainty = clamp(
    input.forecast?.learningResponseUncertainty ?? 0.25,
    0.05,
    0.6,
  );
  const maxDay = HORIZON_DAYS;
  const days = new Set<number>([0, maxDay]);
  for (let day = STEP_DAYS; day < maxDay; day += STEP_DAYS) days.add(day);
  const currentUncertainty = currentScore.uncertainty ?? 150;
  const roomFraction = OBSERVED_BEHAVIOR_ROOM_FRACTION;
  const scoredSections = currentScore.sections.filter(
    (section) => section.currentEstimate != null,
  );
  const hasSectionDose =
    scoredSections.length > 0 && Object.keys(effectiveDoseBySection).length > 0;

  const points = [...days]
    .sort((left, right) => left - right)
    .map((day) => {
      const weeks = day / 7;
      const estimateUncertainty = currentUncertainty * Math.exp(-day / 180);
      const projectedDistribution = NORMAL_QUANTILE_SAMPLES.flatMap(
        (estimateZ) =>
          NORMAL_QUANTILE_SAMPLES.map((responseZ) => {
            const sampledCurrent = clamp(
              currentScore.currentEstimate! + estimateZ * estimateUncertainty,
              900,
              MAX_TOTAL_SCORE,
            );
            const sampledLearningResponse = clamp(
              learningResponse + responseZ * responseUncertainty,
              0.1,
              2,
            );
            if (!hasSectionDose) {
              const response = responseAtDose(
                recentDose * sampledLearningResponse * weeks,
              );
              return {
                total:
                  sampledCurrent +
                  (MAX_TOTAL_SCORE - sampledCurrent) *
                    roomFraction *
                    response *
                    sampledLearningResponse,
                sections: {},
              };
            }
            const currentTotal = scoredSections.reduce(
              (total, section) => total + section.currentEstimate!,
              0,
            );
            const currentDelta = sampledCurrent - currentTotal;
            const sections = Object.fromEntries(
              scoredSections.map((section) => {
                const sectionCurrent = clamp(
                  section.currentEstimate! +
                    currentDelta * (section.currentEstimate! / currentTotal),
                  300,
                  900,
                );
                const recent = Math.max(
                  0,
                  recentDoseBySection[section.sectionId] ?? 0,
                );
                const response = responseAtDose(
                  recent * sampledLearningResponse * weeks,
                );
                return [
                  section.sectionId,
                  sectionCurrent +
                    (900 - sectionCurrent) *
                      OBSERVED_BEHAVIOR_ROOM_FRACTION *
                      response *
                      sampledLearningResponse,
                ] as const;
              }),
            );
            return {
              total: Object.values(sections).reduce(
                (total, value) => total + value,
                0,
              ),
              sections,
            };
          }),
      );
      const totals = projectedDistribution.map((sample) => sample.total);
      const sectionPoints = Object.fromEntries(
        scoredSections.flatMap((section) => {
          const values = projectedDistribution.flatMap((sample) => {
            const value = sample.sections[section.sectionId];
            return value == null ? [] : [value];
          });
          return values.length === 0
            ? []
            : [
                [
                  section.sectionId,
                  {
                    lower: roundSectionScore(empiricalQuantile(values, 0.2)),
                    middle: roundSectionScore(empiricalQuantile(values, 0.5)),
                    upper: roundSectionScore(empiricalQuantile(values, 0.8)),
                  },
                ] as const,
              ];
        }),
      );
      const totalAt = (percentile: "lower" | "middle" | "upper") =>
        Object.keys(sectionPoints).length > 0
          ? Object.values(sectionPoints).reduce(
              (total, section) => total + section[percentile],
              0,
            )
          : roundScore(
              empiricalQuantile(
                totals,
                percentile === "lower"
                  ? 0.2
                  : percentile === "middle"
                    ? 0.5
                    : 0.8,
              ),
            );
      return {
        date: addDays(input.today, day),
        day,
        lower: totalAt("lower"),
        middle: totalAt("middle"),
        upper: totalAt("upper"),
        sections: sectionPoints,
      };
    });

  return {
    status: "available",
    modelVersion,
    doseSource: "recent_behavior",
    coreSectionEquivalentsPerWeek: Math.round(dose * 100) / 100,
    recentCoreSectionEquivalentsPerWeek: Math.round(recentDose * 100) / 100,
    plannedCoreSectionEquivalentsPerWeek: 0,
    expectedPlanUptake: 0,
    recentCoreSectionEquivalentsPerWeekBySection: recentDoseBySection,
    plannedCoreSectionEquivalentsPerWeekBySection: plannedDoseBySection,
    effectiveCoreSectionEquivalentsPerWeekBySection: effectiveDoseBySection,
    percentiles: { lower: 20, middle: 50, upper: 80 },
    history,
    points,
  };
}
