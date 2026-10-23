/** Scheduling wall-clock values, deliberately independent of a timezone or date. */
export function parseTime(input: string): string | null {
  const match = input.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (minutes > 59 || hours > 23) return null;
  if (match[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = hours % 12 + (match[3] === 'pm' ? 12 : 0);
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeLabel(value: string): string {
  const parsed = parseTime(value);
  if (!parsed) return value;
  const [hour, minute] = parsed.split(':');
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? 'pm' : 'am'}`;
}

const presets = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String((index % 4) * 15).padStart(2, '0')}`);

export function timeOptions(query: string): string[] {
  const exact = parseTime(query);
  if (!query.trim()) return presets;
  const filtered = presets.filter((value) => `${value} ${timeLabel(value)}`.includes(query.trim().toLowerCase()));
  return exact ? [exact, ...filtered.filter((value) => value !== exact)] : filtered;
}
