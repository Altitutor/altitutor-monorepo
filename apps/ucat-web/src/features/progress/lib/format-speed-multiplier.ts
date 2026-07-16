function trimToTwoDecimals(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Formats a stored speed ratio, where 1 is exam pace. */
export function formatSpeedMultiplier(
  speedRatio: number | null | undefined,
): string {
  if (speedRatio == null || !Number.isFinite(speedRatio)) return "—";
  return `${trimToTwoDecimals(speedRatio)}x`;
}

/** Formats a historical speed percentage, where 100 is exam pace. */
export function formatSpeedPercentAsMultiplier(
  speedPercent: number | null | undefined,
): string {
  if (speedPercent == null || !Number.isFinite(speedPercent)) return "—";
  return formatSpeedMultiplier(speedPercent / 100);
}
