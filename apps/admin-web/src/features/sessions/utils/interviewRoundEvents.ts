import { interviewRoundDurationMinutes, type Json } from '@altitutor/shared';
export { interviewRoundDurationMinutes } from '@altitutor/shared';

export type InterviewRoundCalendarEvent = {
  id: string;
  name: string;
  scheduledAt: string;
  endAt: string;
  startedAt: string | null;
  phase: string;
  delivery: 'online' | 'in_person';
  mode: 'exam' | 'feedback';
  recordingEnabled: boolean;
  students: { id: string; name: string }[];
  tutors: { id: string; name: string }[];
};

function people(value: unknown): { id: string; name: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.name !== 'string') return [];
    return [{ id: record.id, name: record.name }];
  });
}

export function interviewRoundFromRow(row: {
  id: string;
  data: Json;
}): InterviewRoundCalendarEvent | null {
  if (!row.data || typeof row.data !== 'object' || Array.isArray(row.data)) return null;
  const data = row.data as Record<string, Json | undefined>;
  if (typeof data.scheduledAt !== 'string' || Number.isNaN(Date.parse(data.scheduledAt))) return null;
  const reading = typeof data.readingTimeSeconds === 'number' ? data.readingTimeSeconds : 0;
  const question = typeof data.questionTimeSeconds === 'number' ? data.questionTimeSeconds : 0;
  const minutes = interviewRoundDurationMinutes(reading, question, Array.isArray(data.stations) ? data.stations.length : 1);
  return {
    id: row.id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Interview round',
    scheduledAt: data.scheduledAt,
    endAt: new Date(Date.parse(data.scheduledAt) + minutes * 60_000).toISOString(),
    startedAt: typeof data.startedAt === 'string' ? data.startedAt : null,
    phase: typeof data.phase === 'string' ? data.phase : 'waiting',
    delivery: data.delivery === 'in_person' ? 'in_person' : 'online',
    mode: data.mode === 'feedback' ? 'feedback' : 'exam',
    recordingEnabled: data.recordingEnabled === true,
    students: people(data.students),
    tutors: people(data.tutors),
  };
}

export function interviewRoundStatus(round: {
  phase: string;
  startedAt: string | null;
  scheduledAt: string | null;
}) {
  if (round.phase === 'completed') return 'Completed';
  if (round.startedAt) return round.phase.charAt(0).toUpperCase() + round.phase.slice(1);
  if (round.scheduledAt) return 'Scheduled';
  return 'Waiting room';
}

export function interviewRoundRoomLabel(round: { phase: string; startedAt: string | null }) {
  if (round.phase === 'completed') return 'Review results';
  if (round.startedAt) return 'Rejoin interview';
  return 'Open waiting room';
}

export function interviewRoundRoomUrl(round: { id: string; phase: string; startedAt: string | null }) {
  const origin = new URL(
    process.env.NEXT_PUBLIC_TUTOR_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://tutor.altitutor.com' : 'http://localhost:3002'),
  ).origin;
  const section = round.phase === 'completed' ? 'results' : round.startedAt ? 'live' : 'waiting';
  return `${origin}/interviews/rounds/${round.id}/${section}`;
}
