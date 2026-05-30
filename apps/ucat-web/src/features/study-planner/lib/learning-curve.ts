import { levenbergMarquardt } from "ml-levenberg-marquardt";
import { MODEL_DEFAULTS } from "./constants";

export type CurveObservation = {
  q: number;
  score: number;
};

export type CurveFit = {
  sInf: number;
  k: number;
};

type FitCurveOptions = {
  maxRefitKMultiplier?: number;
  maxRefitSInfUplift?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function projectScore(
  s0: number,
  sInf: number,
  k: number,
  sHat: number,
  qCurrent: number,
  qFuture: number,
): number {
  const deltaQ = Math.max(0, qFuture - qCurrent);
  const raw = sInf - (sInf - sHat) * Math.exp(-k * deltaQ);
  return clamp(raw, MODEL_DEFAULTS.SCORE_MIN, MODEL_DEFAULTS.SCORE_MAX);
}

export function fitCurve(
  observations: CurveObservation[],
  s0: number,
  priorK: number,
  priorSInfUplift: number,
  options: FitCurveOptions = {},
): CurveFit {
  const maxRefitKMultiplier =
    options.maxRefitKMultiplier ?? MODEL_DEFAULTS.MAX_REFIT_K_MULTIPLIER;
  const maxRefitSInfUplift =
    options.maxRefitSInfUplift ?? MODEL_DEFAULTS.MAX_REFIT_SINF_UPLIFT;

  const clean = observations
    .filter((obs) => Number.isFinite(obs.q) && Number.isFinite(obs.score))
    .map((obs) => ({ q: Math.max(0, obs.q), score: obs.score }));

  if (clean.length < 2) {
    return {
      sInf: clamp(
        s0 + priorSInfUplift,
        s0 + 10,
        MODEL_DEFAULTS.SCORE_MAX,
      ),
      k: Math.max(priorK, 1e-7),
    };
  }

  const x = clean.map((obs) => obs.q);
  const y = clean.map((obs) => obs.score);
  const initialSInf = clamp(
    s0 + priorSInfUplift,
    s0 + 10,
    MODEL_DEFAULTS.SCORE_MAX,
  );
  const initialK = Math.max(priorK, 1e-7);

  const minSInf = s0 + 10;
  const maxSInf = Math.min(s0 + maxRefitSInfUplift, MODEL_DEFAULTS.SCORE_MAX);
  const minK = 1e-7;
  const maxK = Math.max(minK, priorK * maxRefitKMultiplier);

  const fit = levenbergMarquardt(
    { x, y },
    ([sInf, k]) =>
      (q) => sInf - (sInf - s0) * Math.exp(-Math.max(k, minK) * q),
    {
      initialValues: [initialSInf, initialK],
      minValues: [minSInf, minK],
      maxValues: [maxSInf, maxK],
      maxIterations: 250,
      damping: 1.5,
      errorTolerance: 1e-4,
    },
  );

  const sInf = clamp(fit.parameterValues[0] ?? initialSInf, minSInf, maxSInf);
  const k = clamp(fit.parameterValues[1] ?? initialK, minK, maxK);

  return { sInf, k };
}
