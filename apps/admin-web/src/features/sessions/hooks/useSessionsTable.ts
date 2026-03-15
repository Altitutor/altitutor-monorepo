import { useMemo, useCallback } from 'react';
import type { Tables, DataTableState } from '@altitutor/shared';
import { useSessionsWithDetails } from './useSessionsQuery';
import { useStudentSearchForFilter } from './useStudentSearchForFilter';
import { useStaffSearchForFilter } from './useStaffSearchForFilter';
import {
  formatSessionTableDate,
  formatSessionTimeRange,
  getClassDisplay,
  getClassShortDisplay,
  filterSessionsByStudents,
  filterSessionsByTutorLog,
  paginateSessions,
} from '../utils/sessionsTableHelpers';

export interface UseSessionsTableProps {
  // External props
  studentId?: string;
  staffId?: string;
  classId?: string;
  adminShiftId?: string;
  limit?: number;
  rangeStart?: string;
  rangeEnd?: string;
  hideStudentFilter?: boolean;
  initialStudentFilters?: string[];
  onResetDates?: () => void;
  studentSearchQuery?: string;
  staffSearchQuery?: string;

  // New: state from useDataTable
  state?: DataTableState;
}

export interface UseSessionsTableReturn {
  // Student search (for filter options)
  filteredStudents: Tables<'students'>[];
  filteredStaff: Tables<'staff'>[];

  // Data
  allSessions: Tables<'sessions'>[];
  filteredSessions: Tables<'sessions'>[];
  paginatedSessions: Tables<'sessions'>[];
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
  sessionStudents: Record<string, Array<Tables<'students'> & {
    planned_absence?: boolean;
    actual_attended?: boolean | null;
    sessions_students_id?: string | null;
    is_extra?: boolean;
    was_trial?: boolean;
    is_rescheduled?: boolean;
    is_credited?: boolean;
    rescheduled_session?: unknown;
  }>>;
  sessionStaff: Record<string, Array<Tables<'staff'> & {
    planned_absence?: boolean;
    actual_attended?: boolean | null;
    actual_was_trial?: boolean | null;
    was_trial?: boolean;
    is_swapped_in?: boolean;
  }>>;
  tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }>;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;

  // Formatting helpers
  formatDate: (dateString: string) => string;
  getTimeRange: (session: Tables<'sessions'>) => string;
  getClassDisplayName: (session: Tables<'sessions'>) => string;
  getClassShortDisplayName: (session: Tables<'sessions'>) => string;
}

export function useSessionsTable({
  studentId,
  staffId,
  classId,
  adminShiftId,
  limit,
  rangeStart,
  rangeEnd,
  hideStudentFilter = false,
  initialStudentFilters = [],
  studentSearchQuery = '',
  staffSearchQuery = '',
  state,
}: UseSessionsTableProps): UseSessionsTableReturn {
  // Use state from useDataTable if provided, otherwise default to empty/1
  const search = state?.search || '';
  const filters = state?.filters || {};
  const page = state?.page || 1;
  const pageSize = state?.pageSize || 50;
  const sortDirection = state?.sortDirection || 'desc';

  // Extract specific filters (wrapped in useMemo for stable refs in downstream useMemo)
  const typeFilters = (filters.type as string[]) || [];
  const subjectFilters = useMemo(
    () => (filters.subject as string[]) || [],
    [filters.subject]
  );
  const studentFilters = (filters.student as string[]) || [];
  const staffFilters = useMemo(
    () => (filters.staff as string[]) || [],
    [filters.staff]
  );
  const tutorLogFilters = (filters.tutor_log as string[]) || [];
  const fromFilters = (filters.from as string[]) || [];
  const toFilters = (filters.to as string[]) || [];
  const effectiveRangeStart = rangeStart || fromFilters[0];
  const effectiveRangeEnd = rangeEnd || toFilters[0];
  
  const showLogged = tutorLogFilters.length === 0 || tutorLogFilters.includes('logged');
  const showUnlogged = tutorLogFilters.length === 0 || tutorLogFilters.includes('unlogged');

  // Student search using RPC hook (for populating filter options)
  const { data: studentSearchData } = useStudentSearchForFilter(
    studentSearchQuery,
    ['ACTIVE', 'TRIAL']
  );
  const { data: staffSearchData } = useStaffSearchForFilter(staffSearchQuery);

  const filteredStudents = useMemo(() => {
    return studentSearchData?.students || [];
  }, [studentSearchData?.students]);
  const filteredStaff = useMemo(() => {
    return staffSearchData?.staff || [];
  }, [staffSearchData?.staff]);

  // Determine which student filters to use for API call
  const activeStudentFilters = hideStudentFilter
    ? initialStudentFilters
    : studentFilters;
  const apiStudentId =
    studentId || (activeStudentFilters.length === 1 ? activeStudentFilters[0] : undefined);
  const apiStaffId = staffId || (staffFilters.length === 1 ? staffFilters[0] : undefined);

  // Fetch sessions data
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useSessionsWithDetails({
    rangeStart: effectiveRangeStart || undefined,
    rangeEnd: effectiveRangeEnd || undefined,
    includeInactive: false,
    search: search,
    studentId: apiStudentId,
    staffId: apiStaffId,
    classId,
    adminShiftId,
    types: typeFilters.length > 0 ? typeFilters : undefined,
    orderBy: 'start_at',
    ascending: sortDirection === 'asc',
  });

  // Extract data from response
  const allSessions = useMemo(() => data?.sessions || [], [data?.sessions]);
  const classesById = useMemo(() => data?.classesById || {}, [data?.classesById]);
  const subjectsById = useMemo(() => data?.subjectsById || {}, [data?.subjectsById]);
  const sessionStudents = useMemo(() => data?.sessionStudents || {}, [data?.sessionStudents]);
  const sessionStaff = useMemo(() => data?.sessionStaff || {}, [data?.sessionStaff]);
  const tutorLogs = useMemo(() => data?.tutorLogs || {}, [data?.tutorLogs]);

  // Helper: get subject_id for a session (session.subject_id or class.subject_id)
  const getSessionSubjectId = useCallback(
    (session: Tables<'sessions'>): string | null => {
      if (session.subject_id) return session.subject_id;
      if (session.class_id && classesById[session.class_id]?.subject_id) {
        return classesById[session.class_id].subject_id;
      }
      return null;
    },
    [classesById]
  );

  // Client-side filtering (for things not handled by the API yet)
  const filteredSessions = useMemo(() => {
    if (!allSessions.length) return [];

    let result = [...allSessions];

    // Filter by subject (client-side)
    if (subjectFilters.length > 0) {
      const subjectIdSet = new Set(subjectFilters);
      result = result.filter((session) => {
        const sid = getSessionSubjectId(session);
        return sid !== null && subjectIdSet.has(sid);
      });
    }

    // Filter by multiple student IDs (if more than one selected and API didn't handle it)
    if (activeStudentFilters.length > 1) {
      result = filterSessionsByStudents(result, activeStudentFilters, sessionStudents);
    }

    // Filter by multiple staff IDs (if more than one selected and API didn't handle it)
    if (staffFilters.length > 1) {
      result = result.filter((session) => {
        const staffInSession = sessionStaff[session.id] || [];
        return staffInSession.some((s) => staffFilters.includes(s.id));
      });
    }

    // Filter by tutor log status (client-side for now)
    result = filterSessionsByTutorLog(result, showLogged, showUnlogged, tutorLogs);

    return result;
  }, [
    allSessions,
    subjectFilters,
    getSessionSubjectId,
    activeStudentFilters,
    sessionStudents,
    showLogged,
    showUnlogged,
    tutorLogs,
    staffFilters,
    sessionStaff,
  ]);

  // Pagination
  const paginatedSessions = useMemo(() => {
    return paginateSessions(filteredSessions, page, pageSize, limit);
  }, [filteredSessions, page, pageSize, limit]);

  // Formatting helpers
  const formatDate = useCallback((dateString: string) => {
    return formatSessionTableDate(dateString);
  }, []);

  const getTimeRange = useCallback(
    (session: Tables<'sessions'>) => {
      return formatSessionTimeRange(session);
    },
    []
  );

  const getClassDisplayName = useCallback(
    (session: Tables<'sessions'>) => {
      return getClassDisplay(session, classesById, subjectsById);
    },
    [classesById, subjectsById]
  );

  const getClassShortDisplayName = useCallback(
    (session: Tables<'sessions'>) => {
      return getClassShortDisplay(session, classesById, subjectsById);
    },
    [classesById, subjectsById]
  );

  return {
    // Student search
    filteredStudents,
    filteredStaff,

    // Data
    allSessions,
    filteredSessions,
    paginatedSessions,
    classesById,
    subjectsById,
    sessionStudents,
    sessionStaff,
    tutorLogs,
    isLoading,
    error: error as Error | null,
    isFetching,
    refetch,

    // Formatting helpers
    formatDate,
    getTimeRange,
    getClassDisplayName,
    getClassShortDisplayName,
  };
}
