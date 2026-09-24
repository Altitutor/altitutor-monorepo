import { formatSessionDate } from '@altitutor/shared';

export { formatSessionDate };

export const HOMEWORK_HELP_DISPLAY_NAME = 'Homework help';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type SessionTiming = {
  session_id: string;
  session_type: string;
  start_at: string | null;
  end_at: string | null;
};

type SessionPerson = {
  id: string;
  first_name: string;
  last_name: string;
};

export function isHomeworkHelpSessionType(sessionType: string | null | undefined): boolean {
  return sessionType === 'HOMEWORK_HELP';
}

export function sessionsAreBackToBack(
  earlier: { end_at: string | null },
  later: { start_at: string | null },
): boolean {
  if (!earlier.end_at || !later.start_at) return false;
  return new Date(earlier.end_at).getTime() === new Date(later.start_at).getTime();
}

export function collectAdjacentHomeworkHelpSessions<T extends SessionTiming>(
  sessions: T[],
  anchorSessionId: string,
): T[] {
  const anchor = sessions.find((session) => session.session_id === anchorSessionId);
  if (!anchor || !isHomeworkHelpSessionType(anchor.session_type)) {
    return anchor ? [anchor] : [];
  }

  const homeworkSessions = sessions.filter(
    (session) =>
      isHomeworkHelpSessionType(session.session_type) &&
      session.start_at &&
      session.end_at,
  );

  const byStart = [...homeworkSessions].sort(
    (a, b) => new Date(a.start_at!).getTime() - new Date(b.start_at!).getTime(),
  );

  const chains: T[][] = [];
  let currentChain: T[] = [];

  for (const session of byStart) {
    if (currentChain.length === 0) {
      currentChain = [session];
      continue;
    }

    const previous = currentChain[currentChain.length - 1]!;
    if (sessionsAreBackToBack(previous, session)) {
      currentChain.push(session);
    } else {
      chains.push(currentChain);
      currentChain = [session];
    }
  }

  if (currentChain.length > 0) {
    chains.push(currentChain);
  }

  const matchingChain = chains.find((chain) =>
    chain.some((session) => session.session_id === anchorSessionId),
  );

  return matchingChain ?? [anchor];
}

export function mergeUniquePeople<T extends SessionPerson>(
  lists: Array<Array<T> | null | undefined>,
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const list of lists) {
    for (const person of list ?? []) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      merged.push(person);
    }
  }

  return merged;
}

export function getMergedSessionTimeRange<T extends SessionTiming>(sessions: T[]): {
  start_at: string | null;
  end_at: string | null;
} {
  const timedSessions = sessions.filter((session) => session.start_at && session.end_at);
  if (timedSessions.length === 0) {
    return { start_at: null, end_at: null };
  }

  const startAt = timedSessions.reduce((earliest, session) =>
    new Date(session.start_at!).getTime() < new Date(earliest).getTime()
      ? session.start_at!
      : earliest,
  timedSessions[0]!.start_at!);

  const endAt = timedSessions.reduce((latest, session) =>
    new Date(session.end_at!).getTime() > new Date(latest).getTime()
      ? session.end_at!
      : latest,
  timedSessions[0]!.end_at!);

  return { start_at: startAt, end_at: endAt };
}

/**
 * Flattened session data from vstudent_session_detail view
 */
export type FlattenedSessionDetail = {
  session_id: string;
  session_type: string;
  class_id: string | null;
  subject_id: string | null;
  start_at: string | null;
  end_at: string | null;
  // Class fields (flattened)
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  class_level: string | null;
  class_status: string | null;
  // Subject fields (flattened)
  subject_name: string | null;
  subject_curriculum: string | null;
  subject_discipline: string | null;
  subject_level: string | null;
  subject_color: string | null;
  subject_year_level: number | null;
  subject_short_name: string | null;
  subject_long_name: string | null;
  long_name?: string | null;
  // Related data
  students?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    year_level?: number;
  }>;
  staff?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    role?: string;
    type?: string;
  }>;
};

/**
 * Generates a session title.
 * Prefers session long_name when present (e.g. from view); otherwise builds from parts.
 */
export function getSessionTitle(session: FlattenedSessionDetail): string {
  if (isHomeworkHelpSessionType(session.session_type)) {
    return HOMEWORK_HELP_DISPLAY_NAME;
  }

  if (session.long_name?.trim()) return session.long_name.trim();

  const parts: string[] = [];
  // Add curriculum
  if (session.subject_curriculum) {
    parts.push(session.subject_curriculum);
  }
  
  // Add year level
  if (session.subject_year_level != null) {
    parts.push(`Year ${session.subject_year_level}`);
  }
  
  // Add subject name
  if (session.subject_name) {
    parts.push(session.subject_name);
  }
  
  // Add class level
  if (session.class_level) {
    parts.push(session.class_level);
  }
  
  // Add day name
  if (session.day_of_week != null) {
    parts.push(DAY_NAMES[session.day_of_week]);
  }
  
  // Add time range
  if (session.start_time && session.end_time) {
    parts.push(`${session.start_time} - ${session.end_time}`);
  }
  
  return parts.join(' ');
}
