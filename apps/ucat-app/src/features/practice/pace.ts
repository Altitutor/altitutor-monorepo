/** Convert an exam-speed multiplier to the timer rate expected by practice APIs. */
export function practiceSecondsPerQuestion(
  examSeconds: number | null,
  pace: number,
  timed: boolean,
): number | null {
  if (!timed) return null;
  if (examSeconds === null || !Number.isFinite(examSeconds) || examSeconds <= 0)
    throw new Error(
      "Timing is unavailable for this section. Please try again.",
    );
  if (!Number.isFinite(pace) || pace < 0.25 || pace > 2)
    throw new Error("Choose a pace between 0.25× and 2×.");
  return examSeconds / pace;
}
