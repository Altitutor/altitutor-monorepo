import { MODEL_DEFAULTS, type TrajectoryStatus } from "./constants";

export type ComputeRNeededResult = {
  rNeeded: number;
  ceilingWarning: boolean;
  paceWarning: boolean;
};

export function computeRNeeded(params: {
  targetScore: number;
  sHat: number;
  sInf: number;
  k: number;
  qCumulative: number;
  daysRemaining: number;
  maxDailyQuestions?: number;
}): ComputeRNeededResult {
  const {
    targetScore,
    sHat,
    sInf,
    k,
    qCumulative,
    daysRemaining,
    maxDailyQuestions = MODEL_DEFAULTS.MAX_DAILY_QUESTIONS,
  } = params;

  if (daysRemaining <= 0 || k <= 0) {
    return {
      rNeeded: Number.POSITIVE_INFINITY,
      ceilingWarning: targetScore > sInf,
      paceWarning: true,
    };
  }

  if (targetScore >= sInf) {
    return {
      rNeeded: Number.POSITIVE_INFINITY,
      ceilingWarning: true,
      paceWarning: true,
    };
  }

  const numerator = sInf - targetScore;
  const denominator = sInf - sHat;

  if (denominator <= 0 || numerator <= 0) {
    return {
      rNeeded: 0,
      ceilingWarning: false,
      paceWarning: false,
    };
  }

  const qNeededTotal = -(1 / k) * Math.log(numerator / denominator);
  const rNeeded = Math.max(0, (qNeededTotal - qCumulative) / daysRemaining);

  return {
    rNeeded,
    ceilingWarning: false,
    paceWarning: rNeeded > maxDailyQuestions,
  };
}

export function getTrajectoryStatus(
  projectedScoreAtTestDate: number,
  targetScore: number,
): TrajectoryStatus {
  if (projectedScoreAtTestDate >= targetScore + 20) return "ahead";
  if (projectedScoreAtTestDate >= targetScore - 10) return "on_track";
  if (projectedScoreAtTestDate >= targetScore - 40) return "behind";
  return "at_risk";
}
