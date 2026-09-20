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
export function practiceWeeks(
  days: { dateKey: string; questionAttempts: number }[],
  today: string,
) {
  const last = new Date(`${today}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() - last.getUTCDay());
  const earliest = days.reduce(
    (first, d) => (d.dateKey < first ? d.dateKey : first),
    today,
  );
  const weekCount = Math.max(
    4,
    Math.ceil(
      (last.getTime() - Date.parse(`${earliest}T12:00:00Z`)) / 604800000,
    ) + 1,
  );
  const counts = new Map(days.map((d) => [d.dateKey, d.questionAttempts]));
  return Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(last);
      date.setUTCDate(date.getUTCDate() - (weekCount - 1 - week) * 7 + day);
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        count: counts.get(key) ?? 0,
        today: key === today,
        future: key > today,
      };
    }),
  );
}
