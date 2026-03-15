import type { Tables } from '@altitutor/shared';
import { getClassDisplay, getClassShortDisplay } from '@/features/students/utils/sessionDisplayHelpers';

export { getClassDisplay, getClassShortDisplay };

/**
 * Format date for session table display
 */
export function formatSessionTableDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Format time range for session display
 */
export function formatSessionTimeRange(session: Tables<'sessions'>): string {
  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes}${period}`;
  };

  if (!session.start_at || !session.end_at) {
    if (session.start_at) {
      return formatTime(new Date(session.start_at));
    }
    if (session.end_at) {
      return formatTime(new Date(session.end_at));
    }
    return '-';
  }

  const startDate = new Date(session.start_at);
  const endDate = new Date(session.end_at);

  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if filters are in default state
 */
export function isDefaultFilterState(
  studentFilters: string[],
  typeFilters: string[],
  searchTerm: string,
  rangeStart?: string,
  rangeEnd?: string
): boolean {
  const todayString = getTodayDateString();
  return (
    studentFilters.length === 0 &&
    typeFilters.length === 0 &&
    searchTerm === '' &&
    rangeStart === todayString &&
    rangeEnd === todayString
  );
}

/**
 * Filter sessions by multiple student IDs (client-side)
 */
export function filterSessionsByStudents(
  sessions: Tables<'sessions'>[],
  studentIds: string[],
  sessionStudents: Record<string, Tables<'students'>[]>
): Tables<'sessions'>[] {
  if (studentIds.length <= 1) return sessions;

  return sessions.filter((session) => {
    const students = sessionStudents[session.id] || [];
    return students.some((s) => studentIds.includes(s.id));
  });
}

/**
 * Filter sessions by tutor log status
 */
export function filterSessionsByTutorLog(
  sessions: Tables<'sessions'>[],
  showLogged: boolean,
  showUnlogged: boolean,
  tutorLogs: Record<string, unknown>
): Tables<'sessions'>[] {
  if (showLogged && showUnlogged) return sessions;

  return sessions.filter((session) => {
    const hasTutorLog = !!tutorLogs[session.id];
    if (hasTutorLog) {
      return showLogged;
    } else {
      return showUnlogged;
    }
  });
}

/**
 * Paginate sessions
 */
export function paginateSessions(
  sessions: Tables<'sessions'>[],
  page: number,
  pageSize: number,
  limit?: number
): Tables<'sessions'>[] {
  if (limit && limit > 0) {
    return sessions.slice(0, limit);
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return sessions.slice(start, end);
}

/**
 * Get invoice status badge variant
 */
export function getInvoiceStatusBadgeVariant(
  status: string | null | undefined
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } | null {
  if (!status) return null;

  let label = '';
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';

  if (status === 'draft' || status === 'open') {
    label = 'Sent';
    variant = 'secondary';
  } else if (status === 'paid' || status === 'paid_refunded') {
    label = status === 'paid_refunded' ? 'Paid (Refunded)' : 'Paid';
    variant = 'default';
  } else if (status === 'void' || status === 'uncollectible' || status === 'disputed') {
    label = 'Failed';
    variant = 'destructive';
  } else {
    label = status;
    variant = 'outline';
  }

  return { label, variant };
}

