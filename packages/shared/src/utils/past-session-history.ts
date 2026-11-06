import type { Enums } from '../supabase/generated';

export const pastSessionTypes = [
  'CLASS',
  'DRAFTING',
  'EXAM_COURSE',
  'TRIAL_SESSION',
  'ADMIN_SHIFT',
  'CHECK_IN',
  'ADMIN_MEETING',
  'HOMEWORK_HELP',
] as const satisfies readonly Enums<'session_type'>[];

export type PastSessionType = (typeof pastSessionTypes)[number];

export type PastSessionCursor = { startAt: string; id: string };
export type PastSessionPerson = { id: string; name: string };
export type PastSessionHistoryRow = PastSessionCursor & {
  endAt: string | null;
  subject: string;
  subjectColor: string | null;
  staff: PastSessionPerson[];
  students: PastSessionPerson[];
};
export type PastSessionHistoryPage = { rows: PastSessionHistoryRow[]; next: PastSessionCursor | null };
