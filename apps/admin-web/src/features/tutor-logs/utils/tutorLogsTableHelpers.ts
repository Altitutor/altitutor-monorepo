import type { Tables } from '@altitutor/shared';
import { formatDate } from '@/shared/utils/datetime';

/**
 * Format a class display name from class and subject data
 */
export function formatClassDisplayName(
  classId: string | null,
  classesById: Record<string, Tables<'classes'>>,
  subjectsById: Record<string, Tables<'subjects'>>
): string | null {
  if (!classId) return null;
  
  const cls = classesById[classId];
  if (!cls) return null;
  
  const subj = cls.subject_id ? subjectsById[cls.subject_id] : undefined;
  const parts: string[] = [];
  
  if (subj?.curriculum) parts.push(String(subj.curriculum));
  if (subj?.year_level != null) parts.push(String(subj.year_level));
  if (subj?.name) parts.push(subj.name);
  if (cls?.level) parts.push(String(cls.level));
  
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Format a time range from start and end timestamps
 */
export function formatTimeRange(startAt: string | null, endAt: string | null): string {
  const s = startAt ? new Date(startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const e = endAt ? new Date(endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return s && e ? `${s}–${e}` : s || e || '-';
}

/**
 * Format a session date for display
 */
export function formatSessionDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const formatted = formatDate(dateString);
    // formatDate returns empty string for invalid dates
    if (formatted === '') {
      return dateString;
    }
    return formatted;
  } catch (e) {
    return dateString;
  }
}

/**
 * Extract unique staff IDs from tutor logs (created_by field)
 */
export function extractCreatedByStaffIds(tutorLogs: Array<{ created_by: string | null }>): string[] {
  const ids = new Set<string>();
  tutorLogs.forEach((log) => {
    if (log.created_by) ids.add(log.created_by);
  });
  return Array.from(ids);
}

/**
 * Filter tutor logs by staff IDs (client-side filtering for multiple staff)
 */
export function filterTutorLogsByStaff<T extends { id: string; created_by: string | null }>(
  tutorLogs: T[],
  staffFilters: string[],
  staffAttendance: Record<string, Array<{ staff_id: string }>>
): T[] {
  if (staffFilters.length <= 1) {
    // Server-side filtering handles single staff filter
    return tutorLogs;
  }
  
  // Client-side filter for multiple staff IDs
  return tutorLogs.filter((log) => {
    // Check if created by any selected staff
    if (log.created_by && staffFilters.includes(log.created_by)) return true;
    
    // Check if any selected staff attended
    const attendance = staffAttendance[log.id] || [];
    return attendance.some((att) => staffFilters.includes(att.staff_id));
  });
}

/**
 * Resolve subject_id for a tutor log's session (session.subject_id or class.subject_id).
 */
export function getTutorLogSessionSubjectId(
  session: Tables<'sessions'> | undefined,
  classesById: Record<string, Tables<'classes'>>
): string | null {
  if (!session) return null;
  if (session.subject_id) return session.subject_id;
  if (session.class_id && classesById[session.class_id]?.subject_id) {
    return classesById[session.class_id].subject_id;
  }
  return null;
}

export type TutorLogsSessionMetaFilters = {
  typeFilters: string[];
  subjectFilters: string[];
  classFilters: string[];
};

/**
 * Filter tutor logs by session type, subject, and/or class (client-side).
 */
export function filterTutorLogsBySessionMeta<T extends { session_id: string }>(
  tutorLogs: T[],
  sessions: Record<string, Tables<'sessions'>>,
  classesById: Record<string, Tables<'classes'>>,
  { typeFilters, subjectFilters, classFilters }: TutorLogsSessionMetaFilters
): T[] {
  const hasType = typeFilters.length > 0;
  const hasSubject = subjectFilters.length > 0;
  const hasClass = classFilters.length > 0;
  if (!hasType && !hasSubject && !hasClass) {
    return tutorLogs;
  }

  const typeSet = new Set(typeFilters);
  const subjectSet = new Set(subjectFilters);
  const classSet = new Set(classFilters);

  return tutorLogs.filter((log) => {
    const session = sessions[log.session_id];
    if (!session) return false;

    if (hasType && !typeSet.has(session.type)) return false;

    if (hasClass && (!session.class_id || !classSet.has(session.class_id))) return false;

    if (hasSubject) {
      const subjectId = getTutorLogSessionSubjectId(session, classesById);
      if (!subjectId || !subjectSet.has(subjectId)) return false;
    }

    return true;
  });
}

/**
 * Filter tutor logs by student IDs.
 */
export function filterTutorLogsByStudent<T extends { id: string }>(
  tutorLogs: T[],
  studentFilters: string[],
  studentAttendance: Record<string, Array<{ student_id: string }>>
): T[] {
  if (studentFilters.length === 0) {
    return tutorLogs;
  }

  return tutorLogs.filter((log) => {
    const attendance = studentAttendance[log.id] || [];
    return attendance.some((att) => studentFilters.includes(att.student_id));
  });
}

/**
 * Paginate tutor logs
 */
export function paginateTutorLogs<T>(
  items: T[],
  page: number,
  pageSize: number
): T[] {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return items.slice(start, end);
}
