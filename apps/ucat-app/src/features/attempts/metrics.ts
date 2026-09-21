import type { AttemptDetail } from "./api";
export function attemptMetrics(data: AttemptDetail) {
  const score = data.sets
    ? data.sets.reduce((n, s) => n + (s.scorePoints ?? 0), 0)
    : (data.scorePoints ?? null);
  const maximum = data.sets
    ? data.sets.reduce((n, s) => n + (s.totalPoints ?? 0), 0)
    : (data.totalPoints ?? null);
  const times = data.questionAttempts
    .map((q) => q.timeSpentSeconds)
    .filter((t): t is number => t != null && Number.isFinite(t) && t >= 0);
  const sum = times.length ? times.reduce((a, b) => a + b, 0) : null;
  const elapsed = data.completedAt
    ? (Date.parse(data.completedAt) - Date.parse(data.attemptedAt)) / 1000
    : null;
  const duration =
    data.timeTakenSeconds ??
    (elapsed != null && Number.isFinite(elapsed) && elapsed > 0
      ? Math.round(elapsed)
      : sum);
  return {
    score,
    maximum,
    accuracy:
      score != null && maximum != null && maximum > 0
        ? (score / maximum) * 100
        : null,
    duration,
    average:
      sum != null
        ? sum / times.length
        : duration != null && data.questionAttempts.length
          ? duration / data.questionAttempts.length
          : null,
  };
}
export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const rounded = Math.max(0, Math.round(seconds));
  return rounded < 60
    ? `${rounded}s`
    : `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}
