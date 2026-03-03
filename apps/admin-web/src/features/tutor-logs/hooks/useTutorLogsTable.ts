import { useMemo } from 'react';
import { useSearchTutorLogs } from './useTutorLogsQuery';
import { useStaffByIds } from './useStaffByIds';
import { useStaffSearchForFilter } from './useStaffSearchForFilter';
import { useStudentSearchForFilter } from '@/features/sessions/hooks/useStudentSearchForFilter';
import {
  extractCreatedByStaffIds,
  filterTutorLogsByStaff,
  filterTutorLogsByStudent,
  paginateTutorLogs,
} from '../utils/tutorLogsTableHelpers';
import type { Tables, DataTableState } from '@altitutor/shared';

type SortField = 'session_start_at';

type StaffAttendanceItem = {
  staff_id: string;
  first_name: string;
  last_name: string;
  role: string;
  attended: boolean;
  type: string | null;
};

type StudentAttendanceItem = {
  student_id: string;
  first_name: string;
  last_name: string;
  attended: boolean;
};

type TopicItem = {
  topic_id: string;
  code: string;
  name: string;
};

type TopicFileItem = {
  file_id: string;
  code: string;
  file_type: string;
};

export interface UseTutorLogsTableParams {
  rangeStart?: string;
  rangeEnd?: string;
  state?: DataTableState;
  staffSearchQuery?: string;
  studentSearchQuery?: string;
}

export interface UseTutorLogsTableReturn {
  // Data
  tutorLogs: Array<{
    id: string;
    session_id: string;
    created_by: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  sessions: Record<string, Tables<'sessions'>>;
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
  sessionStudents: Record<string, Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>>;
  sessionStaff: Record<string, Array<Tables<'staff'> & { planned_absence?: boolean }>>;
  staffAttendance: Record<string, StaffAttendanceItem[]>;
  studentAttendance: Record<string, StudentAttendanceItem[]>;
  topics: Record<string, TopicItem[]>;
  topicFiles: Record<string, TopicFileItem[]>;
  createdByStaffMap: Record<string, { first_name: string; last_name: string }>;
  
  // Filter state
  filteredStaff: Tables<'staff'>[];
  filteredStudents: Tables<'students'>[];
  
  // Filtered count (for pagination total)
  filteredTutorLogs: Array<{
    id: string;
    session_id: string;
    created_by: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  // Pagination state
  paginatedTutorLogs: Array<{
    id: string;
    session_id: string;
    created_by: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  
  // Loading/error states
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Custom hook for TutorLogsTable state management and data fetching
 */
export function useTutorLogsTable({
  rangeStart,
  rangeEnd,
  state,
  staffSearchQuery = '',
  studentSearchQuery = '',
}: UseTutorLogsTableParams = {}): UseTutorLogsTableReturn {
  // Use state from useDataTable if provided
  const search = state?.search || '';
  const filters = state?.filters || {};
  const page = state?.page || 1;
  const pageSize = state?.pageSize || 50;
  const sortField = (state?.sortBy as SortField) || 'session_start_at';
  const sortDirection = state?.sortDirection || 'desc';
  const fromFilters = (filters.from as string[]) || [];
  const toFilters = (filters.to as string[]) || [];
  const effectiveRangeStart = rangeStart || fromFilters[0];
  const effectiveRangeEnd = rangeEnd || toFilters[0];

  // Extract staff/student filters (wrapped in useMemo for stable refs in downstream useMemo)
  const staffFilters = useMemo(
    () => (filters.staff as string[]) || [],
    [filters.staff]
  );
  const studentFilters = useMemo(
    () => (filters.student as string[]) || [],
    [filters.student]
  );

  // Staff search hook (for filter options)
  const { data: staffSearchResults } = useStaffSearchForFilter(staffSearchQuery);
  const { data: studentSearchResults } = useStudentSearchForFilter(studentSearchQuery, ['ACTIVE', 'TRIAL']);
  const filteredStaff = useMemo(() => {
    return (staffSearchResults?.staff || []) as Tables<'staff'>[];
  }, [staffSearchResults?.staff]);
  const filteredStudents = useMemo(() => {
    return (studentSearchResults?.students || []) as Tables<'students'>[];
  }, [studentSearchResults?.students]);

  // Determine which staff filter to use for API call
  const apiStaffId = staffFilters.length === 1 ? staffFilters[0] : undefined;

  // React Query hook for data fetching
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useSearchTutorLogs({
    rangeStart: effectiveRangeStart || undefined,
    rangeEnd: effectiveRangeEnd || undefined,
    search: search,
    staffId: apiStaffId,
    limit: 10000, // High limit to get all
    offset: 0,
    orderBy: sortField,
    ascending: sortDirection === 'asc',
  });

  // Extract data from the response
  const tutorLogs = useMemo(
    () => (data?.tutorLogs || []) as Array<{
      id: string;
      session_id: string;
      created_by: string | null;
      created_at: string;
      updated_at: string | null;
    }>,
    [data?.tutorLogs]
  );
  const sessions = useMemo(
    () => (data?.sessions || {}) as Record<string, Tables<'sessions'>>,
    [data?.sessions]
  );
  const classesById = useMemo(
    () => (data?.classesById || {}) as Record<string, Tables<'classes'>>,
    [data?.classesById]
  );
  const subjectsById = useMemo(
    () => (data?.subjectsById || {}) as Record<string, Tables<'subjects'>>,
    [data?.subjectsById]
  );
  const sessionStudents = useMemo(
    () =>
      (data?.sessionStudents || {}) as Record<
        string,
        Array<Tables<'students'> & { planned_absence?: boolean; is_extra?: boolean }>
      >,
    [data?.sessionStudents]
  );
  const sessionStaff = useMemo(
    () =>
      (data?.sessionStaff || {}) as Record<
        string,
        Array<Tables<'staff'> & { planned_absence?: boolean }>
      >,
    [data?.sessionStaff]
  );
  const staffAttendance = useMemo(
    () => (data?.staffAttendance || {}) as Record<string, StaffAttendanceItem[]>,
    [data?.staffAttendance]
  );
  const studentAttendance = useMemo(
    () => (data?.studentAttendance || {}) as Record<string, StudentAttendanceItem[]>,
    [data?.studentAttendance]
  );
  const topics = useMemo(
    () => (data?.topics || {}) as Record<string, TopicItem[]>,
    [data?.topics]
  );
  const topicFiles = useMemo(
    () => (data?.topicFiles || {}) as Record<string, TopicFileItem[]>,
    [data?.topicFiles]
  );

  // Get unique created_by staff IDs
  const createdByStaffIds = useMemo(
    () => extractCreatedByStaffIds(tutorLogs),
    [tutorLogs]
  );

  // Fetch created_by staff names
  const { data: createdByStaffData } = useStaffByIds(createdByStaffIds);
  const createdByStaffMap = createdByStaffData || {};

  // Filter tutor logs (client-side filtering for multiple staff)
  const filteredTutorLogs = useMemo(() => {
    const staffFiltered = filterTutorLogsByStaff(tutorLogs, staffFilters, staffAttendance);
    return filterTutorLogsByStudent(staffFiltered, studentFilters, studentAttendance);
  }, [tutorLogs, staffFilters, staffAttendance, studentFilters, studentAttendance]);

  // Paginated tutor logs
  const paginatedTutorLogs = useMemo(() => {
    return paginateTutorLogs(filteredTutorLogs, page, pageSize);
  }, [filteredTutorLogs, page, pageSize]);

  return {
    tutorLogs,
    filteredTutorLogs,
    sessions,
    classesById,
    subjectsById,
    sessionStudents,
    sessionStaff,
    staffAttendance,
    studentAttendance,
    topics,
    topicFiles,
    createdByStaffMap,
    filteredStaff,
    filteredStudents,
    paginatedTutorLogs,
    isLoading,
    isFetching,
    error: error as Error | null,
    refetch,
  };
}
