import { adelaideWallDateTimeToUtcIso, utcToAdelaideDate } from '@/features/bookings/utils/dateTimeHelpers';

const adelaideHour = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Adelaide',
  hour: '2-digit',
  hourCycle: 'h23',
});

export function quietHoursSendTime(now: Date): string | undefined {
  const hour = Number(adelaideHour.format(now));
  if (hour >= 8 && hour < 22) return undefined;

  const date = utcToAdelaideDate(now.toISOString());
  const morning = new Date(`${date}T00:00:00Z`);
  if (hour >= 22) morning.setUTCDate(morning.getUTCDate() + 1);
  return adelaideWallDateTimeToUtcIso(morning.toISOString().slice(0, 10), '08:00');
}

export function formatScheduledTextTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Adelaide',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
