import {
  formatPersonDisplayName,
  formatTutorSessionSubjectLabel,
  type TutorSessionSubjectFields,
} from './sessionSubjectLabel';
import type { SessionStaff, SessionStudent } from './session-helpers';

export type PastSessionSearchable = TutorSessionSubjectFields & {
  start_at?: string | null;
  staff: SessionStaff[];
  students: SessionStudent[];
};

export type PastSessionFilterable = PastSessionSearchable & {
  session_type?: string | null;
  subject_id?: string | null;
};

export type PastSessionFilters = {
  types?: string[];
  subjectIds?: string[];
  staffIds?: string[];
  studentIds?: string[];
  /** Inclusive YYYY-MM-DD local calendar day */
  from?: string | null;
  /** Inclusive YYYY-MM-DD local calendar day */
  to?: string | null;
};

export type PastSessionFilterOption = {
  id: string;
  label: string;
};

export function pastSessionLocalDateKey(startAt: string | null | undefined): string | null {
  if (!startAt) return null;
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function pastSessionSearchHaystack(session: PastSessionSearchable): string {
  const staffNames = session.staff.map((member) => formatPersonDisplayName(member)).join(' ');
  const studentNames = session.students
    .map((student) => formatPersonDisplayName(student))
    .join(' ');
  return [
    session.start_at?.slice(0, 10) ?? '',
    formatTutorSessionSubjectLabel(session),
    staffNames,
    studentNames,
  ]
    .join(' ')
    .toLowerCase();
}

export function matchesPastSessionSearch(session: PastSessionSearchable, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return pastSessionSearchHaystack(session).includes(query);
}

export function matchesPastSessionFilters(
  session: PastSessionFilterable,
  filters: PastSessionFilters,
): boolean {
  const types = filters.types ?? [];
  if (types.length > 0 && !types.includes(session.session_type ?? '')) {
    return false;
  }

  const subjectIds = filters.subjectIds ?? [];
  if (subjectIds.length > 0) {
    if (!session.subject_id || !subjectIds.includes(session.subject_id)) {
      return false;
    }
  }

  const staffIds = filters.staffIds ?? [];
  if (staffIds.length > 0) {
    const hasStaff = session.staff.some((member) => member.id && staffIds.includes(member.id));
    if (!hasStaff) return false;
  }

  const studentIds = filters.studentIds ?? [];
  if (studentIds.length > 0) {
    const hasStudent = session.students.some(
      (student) => student.id && studentIds.includes(student.id),
    );
    if (!hasStudent) return false;
  }

  const dateKey = pastSessionLocalDateKey(session.start_at);
  if (filters.from) {
    if (!dateKey || dateKey < filters.from) return false;
  }
  if (filters.to) {
    if (!dateKey || dateKey > filters.to) return false;
  }

  return true;
}

export function filterPastSessions<T extends PastSessionFilterable>(
  sessions: T[],
  search: string,
  filters: PastSessionFilters,
): T[] {
  return sessions.filter(
    (session) =>
      matchesPastSessionSearch(session, search) && matchesPastSessionFilters(session, filters),
  );
}

function compareLabels(a: PastSessionFilterOption, b: PastSessionFilterOption): number {
  return a.label.localeCompare(b.label);
}

export function collectPastSessionTypeValues(sessions: PastSessionFilterable[]): string[] {
  const values = new Set<string>();
  for (const session of sessions) {
    if (session.session_type) values.add(session.session_type);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function collectPastSessionSubjectOptions(
  sessions: PastSessionFilterable[],
): PastSessionFilterOption[] {
  const byId = new Map<string, PastSessionFilterOption>();
  for (const session of sessions) {
    if (!session.subject_id || byId.has(session.subject_id)) continue;
    byId.set(session.subject_id, {
      id: session.subject_id,
      label: formatTutorSessionSubjectLabel(session),
    });
  }
  return [...byId.values()].sort(compareLabels);
}

export function collectPastSessionStaffOptions(
  sessions: PastSessionFilterable[],
): PastSessionFilterOption[] {
  const byId = new Map<string, PastSessionFilterOption>();
  for (const session of sessions) {
    for (const member of session.staff) {
      if (!member.id || byId.has(member.id)) continue;
      byId.set(member.id, {
        id: member.id,
        label: formatPersonDisplayName(member) || 'Unknown',
      });
    }
  }
  return [...byId.values()].sort(compareLabels);
}

export function collectPastSessionStudentOptions(
  sessions: PastSessionFilterable[],
): PastSessionFilterOption[] {
  const byId = new Map<string, PastSessionFilterOption>();
  for (const session of sessions) {
    for (const student of session.students) {
      if (!student.id || byId.has(student.id)) continue;
      byId.set(student.id, {
        id: student.id,
        label: formatPersonDisplayName(student) || 'Student',
      });
    }
  }
  return [...byId.values()].sort(compareLabels);
}

export function parsePastSessionFiltersFromToolbar(
  filters: Record<string, unknown[]>,
): PastSessionFilters {
  const asStrings = (key: string): string[] =>
    (filters[key] ?? []).filter((value): value is string => typeof value === 'string');

  return {
    types: asStrings('type'),
    subjectIds: asStrings('subject'),
    staffIds: asStrings('staff'),
    studentIds: asStrings('student'),
    from: asStrings('from')[0] ?? null,
    to: asStrings('to')[0] ?? null,
  };
}

export function pastSessionsHaveActiveFilters(
  search: string,
  filters: PastSessionFilters,
): boolean {
  if (search.trim()) return true;
  if ((filters.types?.length ?? 0) > 0) return true;
  if ((filters.subjectIds?.length ?? 0) > 0) return true;
  if ((filters.staffIds?.length ?? 0) > 0) return true;
  if ((filters.studentIds?.length ?? 0) > 0) return true;
  if (filters.from) return true;
  if (filters.to) return true;
  return false;
}
