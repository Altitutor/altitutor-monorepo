/**
 * Format an exam/set time limit for student-facing UI.
 * Returns "Untimed" when null/zero; otherwise minutes, or hours+minutes when ≥ 60.
 */
export function formatExamDurationSeconds(
  seconds: number | null | undefined,
): string {
  if (seconds == null || seconds <= 0) return "Untimed";
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
