/** Keep the local date and time together when the next hour crosses midnight. */
export function nextInterviewRoundSchedule(now = new Date()): Date {
  const value = new Date(now);
  value.setHours(value.getHours() + 1, 0, 0, 0);
  return value;
}
