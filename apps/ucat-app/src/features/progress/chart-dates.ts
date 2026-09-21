export function displayChartDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));
}
export function indexNearestToday(dates: string[], today: string) {
  let best = 0;
  let distance = Infinity;
  for (let i = 0; i < dates.length; i++) {
    const delta = Math.abs(Date.parse(dates[i]) - Date.parse(today));
    if (delta < distance) {
      best = i;
      distance = delta;
    }
  }
  return best;
}
