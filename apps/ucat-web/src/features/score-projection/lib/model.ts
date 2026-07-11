import type {
  ProjectionConfidence,
  ProjectionHorizon,
  ProjectionPoint,
} from "@/features/score-projection/types/score-projection";

export const SCORE_MIN = 300;
export const SCORE_MAX = 900;
export const DEFAULT_HORIZONS = [30, 60, 90, 120] as const;

export type ScoreProjectionSettings = {
  mockSourceWeight: number;
  setSourceWeight: number;
  practiceSourceWeight: number;
  timedWeight: number;
  slowTimedWeight: number;
  untimedWeight: number;
  recencyHalfLifeDays: number;
  minPracticeScoredPoints: number;
  minPredictionEvidenceWeight: number;
  defaultEffectiveQuestionsPerWeek: number;
  recentActivityLookbackDays: number;
  effectivePracticeDailyCap: number;
  trajectoryHorizonDays: number;
  trajectoryStepDays: number;
  pessimisticBaseGain: number;
  realisticBaseGain: number;
  optimisticBaseGain: number;
  pessimisticRoomFraction: number;
  realisticRoomFraction: number;
  optimisticRoomFraction: number;
  pessimisticLowScoreBoost: number;
  realisticLowScoreBoost: number;
  optimisticLowScoreBoost: number;
  pessimisticEffortHalfSaturation: number;
  realisticEffortHalfSaturation: number;
  optimisticEffortHalfSaturation: number;
};

export type EvidenceSource = "mock" | "set" | "practice";

export type AttemptEvidence = {
  source: EvidenceSource;
  score: number;
  scoredPoints: number;
  totalPoints: number;
  timestamp: number;
  wasTimed: boolean;
  examSpeedRatio: number | null;
};

export type WeightedEvidence = AttemptEvidence & {
  weight: number;
  effectivePracticeUnits: number;
};

export type SectionEstimate = {
  currentEstimate: number | null;
  confidence: ProjectionConfidence;
  uncertainty: number;
  effectiveEvidenceWeight: number;
  evidenceCount: number;
  weightedEvidence: WeightedEvidence[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundScore(value: number): number {
  return Math.round(clamp(value, SCORE_MIN, SCORE_MAX));
}

function daysAgo(timestamp: number, now: number): number {
  return Math.max(0, (now - timestamp) / (24 * 60 * 60 * 1000));
}

function sourceWeight(
  source: EvidenceSource,
  settings: ScoreProjectionSettings,
): number {
  if (source === "mock") return settings.mockSourceWeight;
  if (source === "set") return settings.setSourceWeight;
  return settings.practiceSourceWeight;
}

function timingWeight(
  evidence: AttemptEvidence,
  settings: ScoreProjectionSettings,
): number {
  if (!evidence.wasTimed) return settings.untimedWeight;
  const ratio = evidence.examSpeedRatio;
  if (ratio == null || !Number.isFinite(ratio)) return settings.timedWeight;
  if (ratio >= 1) return settings.timedWeight;
  return (
    settings.slowTimedWeight +
    (settings.timedWeight - settings.slowTimedWeight) * clamp(ratio, 0, 1)
  );
}

function recencyWeight(
  evidence: AttemptEvidence,
  settings: ScoreProjectionSettings,
  now: number,
): number {
  return Math.pow(
    0.5,
    daysAgo(evidence.timestamp, now) / settings.recencyHalfLifeDays,
  );
}

function volumeWeight(
  evidence: AttemptEvidence,
  _settings: ScoreProjectionSettings,
): number {
  const referencePoints = evidence.source === "practice" ? 40 : 44;
  return clamp(evidence.totalPoints / referencePoints, 0.1, 1);
}

export function weightEvidence(
  evidence: AttemptEvidence,
  settings: ScoreProjectionSettings,
  now = Date.now(),
): WeightedEvidence {
  const source = sourceWeight(evidence.source, settings);
  const timing = timingWeight(evidence, settings);
  const recency = recencyWeight(evidence, settings, now);
  const volume = volumeWeight(evidence, settings);
  const weight = source * timing * recency * volume;

  return {
    ...evidence,
    weight,
    effectivePracticeUnits: evidence.totalPoints * source * timing,
  };
}

export function estimateSectionScore(
  evidence: AttemptEvidence[],
  settings: ScoreProjectionSettings,
  now = Date.now(),
): SectionEstimate {
  const weightedEvidence = evidence
    .filter((item) => Number.isFinite(item.score) && item.totalPoints > 0)
    .map((item) => weightEvidence(item, settings, now));

  const effectiveEvidenceWeight = weightedEvidence.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  const weightedScoreSum = weightedEvidence.reduce(
    (sum, item) => sum + item.score * item.weight,
    0,
  );
  const currentEstimate =
    effectiveEvidenceWeight >= settings.minPredictionEvidenceWeight &&
    effectiveEvidenceWeight > 0
      ? weightedScoreSum / effectiveEvidenceWeight
      : null;

  return {
    currentEstimate:
      currentEstimate == null ? null : roundScore(currentEstimate),
    confidence: confidenceForWeight(effectiveEvidenceWeight),
    uncertainty: uncertaintyForWeight(effectiveEvidenceWeight),
    effectiveEvidenceWeight,
    evidenceCount: weightedEvidence.length,
    weightedEvidence,
  };
}

export function confidenceForWeight(weight: number): ProjectionConfidence {
  if (weight >= 4) return "high";
  if (weight >= 1.5) return "medium";
  return "low";
}

export function uncertaintyForWeight(weight: number): number {
  return Math.round(clamp(90 / (1 + Math.sqrt(Math.max(weight, 0))), 20, 90));
}

export function resolveEffectivePracticePerWeek(
  weightedEvidence: WeightedEvidence[],
  settings: ScoreProjectionSettings,
  now = Date.now(),
): { pace: number; source: "recent_activity" | "default" } {
  const lookbackMs = settings.recentActivityLookbackDays * 24 * 60 * 60 * 1000;
  const cutoff = now - lookbackMs;
  const recentUnits = weightedEvidence
    .filter((item) => item.timestamp >= cutoff)
    .reduce((sum, item) => sum + item.effectivePracticeUnits, 0);

  const pace = (recentUnits / settings.recentActivityLookbackDays) * 7;
  if (pace >= settings.minPracticeScoredPoints) {
    return { pace, source: "recent_activity" };
  }
  return {
    pace: settings.defaultEffectiveQuestionsPerWeek,
    source: "default",
  };
}

function effectivePracticeOverDays(
  effectivePracticePerWeek: number,
  days: number,
  settings: ScoreProjectionSettings,
): number {
  const daily = Math.max(0, effectivePracticePerWeek / 7);
  const cappedDaily =
    settings.effectivePracticeDailyCap *
    (1 - Math.exp(-daily / settings.effectivePracticeDailyCap));
  return cappedDaily * Math.max(0, days);
}

function projectScore(params: {
  currentEstimate: number;
  effectivePractice: number;
  baseGain: number;
  roomFraction: number;
  lowScoreBoost: number;
  effortHalfSaturation: number;
}): number {
  const remainingRoom = SCORE_MAX - params.currentEstimate;
  const lowScoreRoomBoost =
    1 +
    params.lowScoreBoost * clamp((700 - params.currentEstimate) / 400, 0, 1);
  const maxGain = clamp(
    params.baseGain + params.roomFraction * remainingRoom * lowScoreRoomBoost,
    0,
    remainingRoom,
  );
  const effortFactor =
    1 -
    Math.exp(
      -(Math.log(2) * params.effectivePractice) / params.effortHalfSaturation,
    );
  const projected = params.currentEstimate + maxGain * effortFactor;
  return roundScore(projected);
}

export function generateTrajectory(params: {
  currentEstimate: number;
  effectivePracticePerWeek: number;
  settings: ScoreProjectionSettings;
  now?: Date;
  horizons?: readonly number[];
}): { projection: ProjectionPoint[]; horizons: ProjectionHorizon[] } {
  const { currentEstimate, effectivePracticePerWeek, settings } = params;
  const now = params.now ?? new Date();
  const horizons = params.horizons ?? DEFAULT_HORIZONS;
  const maxDay = Math.max(settings.trajectoryHorizonDays, ...horizons);
  const step = Math.max(1, settings.trajectoryStepDays);
  const days = new Set<number>([0, ...horizons]);
  for (let day = step; day <= maxDay; day += step) days.add(day);
  days.add(maxDay);

  const buildPoint = (day: number): ProjectionPoint => {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    const effectivePractice = effectivePracticeOverDays(
      effectivePracticePerWeek,
      day,
      settings,
    );
    return {
      day,
      date: date.toISOString().slice(0, 10),
      pessimistic: projectScore({
        currentEstimate,
        effectivePractice,
        baseGain: settings.pessimisticBaseGain,
        roomFraction: settings.pessimisticRoomFraction,
        lowScoreBoost: settings.pessimisticLowScoreBoost,
        effortHalfSaturation: settings.pessimisticEffortHalfSaturation,
      }),
      realistic: projectScore({
        currentEstimate,
        effectivePractice,
        baseGain: settings.realisticBaseGain,
        roomFraction: settings.realisticRoomFraction,
        lowScoreBoost: settings.realisticLowScoreBoost,
        effortHalfSaturation: settings.realisticEffortHalfSaturation,
      }),
      optimistic: projectScore({
        currentEstimate,
        effectivePractice,
        baseGain: settings.optimisticBaseGain,
        roomFraction: settings.optimisticRoomFraction,
        lowScoreBoost: settings.optimisticLowScoreBoost,
        effortHalfSaturation: settings.optimisticEffortHalfSaturation,
      }),
    };
  };

  const projection = [...days].sort((a, b) => a - b).map(buildPoint);
  const byDay = new Map(projection.map((point) => [point.day, point]));
  return {
    projection,
    horizons: horizons.map((day) => {
      const point = byDay.get(day) ?? buildPoint(day);
      return {
        day,
        pessimistic: point.pessimistic,
        realistic: point.realistic,
        optimistic: point.optimistic,
      };
    }),
  };
}

export function defaultSettings(): ScoreProjectionSettings {
  return {
    mockSourceWeight: 1,
    setSourceWeight: 0.55,
    practiceSourceWeight: 0.25,
    timedWeight: 1,
    slowTimedWeight: 0.75,
    untimedWeight: 0.65,
    recencyHalfLifeDays: 30,
    minPracticeScoredPoints: 8,
    minPredictionEvidenceWeight: 1,
    defaultEffectiveQuestionsPerWeek: 120,
    recentActivityLookbackDays: 21,
    effectivePracticeDailyCap: 60,
    trajectoryHorizonDays: 120,
    trajectoryStepDays: 7,
    pessimisticBaseGain: 10,
    realisticBaseGain: 25,
    optimisticBaseGain: 40,
    pessimisticRoomFraction: 0.35,
    realisticRoomFraction: 0.55,
    optimisticRoomFraction: 0.75,
    pessimisticLowScoreBoost: 0.15,
    realisticLowScoreBoost: 0.25,
    optimisticLowScoreBoost: 0.35,
    pessimisticEffortHalfSaturation: 850,
    realisticEffortHalfSaturation: 650,
    optimisticEffortHalfSaturation: 550,
  };
}
