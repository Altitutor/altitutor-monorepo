import type {
  PreparationCurrentScoreEstimate,
  PreparationEngineInput,
  PreparationTrajectory,
} from "@/features/preparation/model/types";
import type { StudyPlanReadinessSnapshot } from "@/features/study-plan/model/types";
import { addDays, daysBetween } from "@/features/study-plan/lib/dates";

const MAX_TOTAL_SCORE = 2700;
const HORIZON_DAYS = 120;
const STEP_DAYS = 7;
const HALF_SATURATION_SECTION_EQUIVALENTS = 12;
const NORMAL_QUANTILE_SAMPLES = [
  -1.593,
  -0.967,
  -0.589,
  -0.282,
  0,
  0.282,
  0.589,
  0.967,
  1.593,
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 900, MAX_TOTAL_SCORE) / 10) * 10;
}

function phaseRoomFraction(readiness: StudyPlanReadinessSnapshot): number {
  if (readiness.mode === "learning") return 0.42;
  if (readiness.mode === "timing") return 0.55;
  return 0.3;
}

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
  preparation: PreparationEngineInput;
  currentScore: PreparationCurrentScoreEstimate;
  scheduledCoreSectionEquivalentsPerWeek: number;
  readiness: StudyPlanReadinessSnapshot;
}): PreparationTrajectory {
  const { preparation, currentScore } = input;
  const modelVersion = preparation.versions.trajectoryModel;
  const history = (preparation.evidence.forecast?.history ?? []).filter(
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

  const planEnabled = preparation.goal.profile.studyPlanEnabled;
  const dose = planEnabled
    ? input.scheduledCoreSectionEquivalentsPerWeek
    : (preparation.evidence.forecast?.recentCoreSectionEquivalentsPerWeek ?? 0);
  if (dose <= 0) {
    return {
      status: "unavailable",
      reason: "no_future_dose",
      modelVersion,
      history,
      points: [],
    };
  }

  const adherence = clamp(
    preparation.evidence.forecast?.expectedAdherence ?? 0.75,
    0,
    1,
  );
  const learningResponse = clamp(
    preparation.evidence.forecast?.learningResponse ?? 1,
    0.4,
    1.6,
  );
  const responseUncertainty = clamp(
    preparation.evidence.forecast?.learningResponseUncertainty ?? 0.25,
    0.05,
    0.6,
  );
  const adherenceUncertainty = clamp(
    preparation.evidence.forecast?.adherenceUncertainty ?? 0.2,
    0.02,
    0.5,
  );
  const maxDay = Math.max(
    0,
    Math.min(
      HORIZON_DAYS,
      preparation.goal.profile.testDate
        ? daysBetween(
            preparation.clock.today,
            preparation.goal.profile.testDate,
          )
        : HORIZON_DAYS,
    ),
  );
  const days = new Set<number>([0, maxDay]);
  for (let day = STEP_DAYS; day < maxDay; day += STEP_DAYS) days.add(day);
  const currentUncertainty = currentScore.uncertainty ?? 150;
  const roomFraction = phaseRoomFraction(input.readiness);

  const points = [...days]
    .sort((left, right) => left - right)
    .map((day) => {
      const weeks = day / 7;
      const estimateUncertainty = currentUncertainty * Math.exp(-day / 180);
      const projectedDistribution = NORMAL_QUANTILE_SAMPLES.flatMap(
        (estimateZ) =>
          NORMAL_QUANTILE_SAMPLES.flatMap((adherenceZ) =>
            NORMAL_QUANTILE_SAMPLES.map((responseZ) => {
              const sampledCurrent = clamp(
                currentScore.currentEstimate! +
                  estimateZ * estimateUncertainty,
                900,
                MAX_TOTAL_SCORE,
              );
              const sampledAdherence = clamp(
                adherence + adherenceZ * adherenceUncertainty,
                0,
                1,
              );
              const sampledLearningResponse = clamp(
                learningResponse + responseZ * responseUncertainty,
                0.1,
                2,
              );
              const response = responseAtDose(
                dose * sampledAdherence * sampledLearningResponse * weeks,
              );
              return (
                sampledCurrent +
                (MAX_TOTAL_SCORE - sampledCurrent) *
                  roomFraction *
                  response *
                  sampledLearningResponse
              );
            }),
          ),
      );
      return {
        date: addDays(preparation.clock.today, day),
        day,
        lower: roundScore(empiricalQuantile(projectedDistribution, 0.2)),
        middle: roundScore(empiricalQuantile(projectedDistribution, 0.5)),
        upper: roundScore(empiricalQuantile(projectedDistribution, 0.8)),
      };
    });

  return {
    status: "available",
    modelVersion,
    doseSource: planEnabled ? "scheduled_core" : "recent_sustained_workload",
    coreSectionEquivalentsPerWeek: Math.round(dose * 100) / 100,
    expectedAdherence: adherence,
    percentiles: { lower: 20, middle: 50, upper: 80 },
    history,
    points,
  };
}
