import { MODEL_DEFAULTS } from "./constants";
import { projectScore } from "./learning-curve";

export type ProjectionBand = {
  date: string;
  conservative: number;
  realistic: number;
  aggressive: number;
};

export type ProjectionState = {
  s0: number;
  sInf: number;
  k: number;
  sHat: number;
  p: number;
  questionsCumulative: number;
};

export type ProjectionConfig = {
  coneZScore: number;
  deltaKFraction: number;
};

export function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date): number {
  const fromDay = startOfDay(from).getTime();
  const toDay = startOfDay(to).getTime();
  return Math.max(0, Math.round((toDay - fromDay) / (24 * 60 * 60 * 1000)));
}

export function generateProjection(params: {
  state: ProjectionState;
  testDate: Date;
  questionsPerDay: number;
  config?: ProjectionConfig;
}): ProjectionBand[] {
  const { state, testDate, questionsPerDay } = params;
  const config = params.config ?? {
    coneZScore: MODEL_DEFAULTS.CONE_Z_SCORE,
    deltaKFraction: MODEL_DEFAULTS.DELTA_K_FRACTION,
  };

  const today = startOfDay(new Date());
  const endDate = startOfDay(testDate);
  if (endDate < today) return [];

  const days = daysBetween(today, endDate);
  const deltaS = config.coneZScore * Math.sqrt(Math.max(state.p, 1));
  const deltaK = Math.max(0, config.deltaKFraction);

  const sInfConservative = Math.max(
    MODEL_DEFAULTS.SCORE_MIN,
    state.sInf - deltaS,
  );
  const sInfAggressive = Math.min(MODEL_DEFAULTS.SCORE_MAX, state.sInf + deltaS);
  const kConservative = Math.max(1e-7, state.k * (1 - deltaK));
  const kAggressive = Math.max(1e-7, state.k * (1 + deltaK));

  const series: ProjectionBand[] = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    const qFuture = state.questionsCumulative + questionsPerDay * i;

    series.push({
      date: dateKey(date),
      conservative: projectScore(
        state.s0,
        sInfConservative,
        kConservative,
        state.sHat,
        state.questionsCumulative,
        qFuture,
      ),
      realistic: projectScore(
        state.s0,
        state.sInf,
        state.k,
        state.sHat,
        state.questionsCumulative,
        qFuture,
      ),
      aggressive: projectScore(
        state.s0,
        sInfAggressive,
        kAggressive,
        state.sHat,
        state.questionsCumulative,
        qFuture,
      ),
    });
  }

  return series;
}
