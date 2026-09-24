export function formatDashboardTestCountdown(
  testDay: number | null,
): string | null {
  if (testDay == null) return null;
  if (testDay <= 0) return "Your UCAT test is today";
  if (testDay === 1) return "1 day until your UCAT test";
  return `${testDay} days until your UCAT test`;
}
