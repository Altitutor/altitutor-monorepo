import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchTutorLogs } from './useTutorLogsQuery';
import { useStaffSearch } from './useStaffSearch';
import { useStaffByIds } from './useStaffByIds';
import {
  extractCreatedByStaffIds,
  filterTutorLogsByStaff,
  paginateTutorLogs,
} from '../utils/tutorLogsTableHelpers';

type SortField = 'session_start_at';
type SortDirection = 'asc' | 'desc';

export interface UseTutorLogsTableParams {
  rangeStart?: string;
  rangeEnd?: string;
  onResetDates?: () => void;
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
  sessions: Record<string, any>;
  classesById: Record<string, any>;
  subjectsById: Record<string, any>;
  sessionStudents: Record<string, any[]>;
  sessionStaff: Record<string, any[]>;
  staffAttendance: Record<string, any[]>;
  studentAttendance: Record<string, any[]>;
  topics: Record<string, any[]>;
  topicFiles: Record<string, any[]>;
  createdByStaffMap: Record<string, { first_name: string; last_name: string }>;
  
  // Filter state
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  debouncedSearchTerm: string;
  staffFilters: string[];
  toggleStaffFilter: (staffId: string) => void;
  staffSearchQuery: string;
  setStaffSearchQuery: (query: string) => void;
  filteredStaff: any[];
  
  // Pagination state
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  paginatedTutorLogs: Array<{
    id: string;
    session_id: string;
    created_by: string | null;
    created_at: string;
    updated_at: string | null;
  }>;
  
  // Sort state
  sortField: SortField;
  sortDirection: SortDirection;
  handleSort: (field: SortField) => void;
  
  // Loading/error states
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
  
  // Actions
  clearAllFilters: () => void;
  isDefaultState: () => boolean;
}

/**
 * Custom hook for TutorLogsTable state management and data fetching
 */
export function useTutorLogsTable({
  rangeStart,
  rangeEnd,
  onResetDates,
}: UseTutorLogsTableParams = {}): UseTutorLogsTableReturn {
  // Filter and sort state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [staffFilters, setStaffFilters] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState<SortField>('session_start_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Staff search hook
  const { data: staffSearchResults } = useStaffSearch(staffSearchQuery);
  const filteredStaff = staffSearchResults?.staff || [];

  const toggleStaffFilter = useCallback((staffId: string) => {
    setStaffFilters((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  }, []);

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
    rangeStart: rangeStart || undefined,
    rangeEnd: rangeEnd || undefined,
    search: debouncedSearchTerm,
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
    () => (data?.sessions || {}) as Record<string, any>,
    [data?.sessions]
  );
  const classesById = useMemo(
    () => (data?.classesById || {}) as Record<string, any>,
    [data?.classesById]
  );
  const subjectsById = useMemo(
    () => (data?.subjectsById || {}) as Record<string, any>,
    [data?.subjectsById]
  );
  const sessionStudents = useMemo(
    () =>
      (data?.sessionStudents || {}) as Record<
        string,
        Array<any & { planned_absence?: boolean; is_extra?: boolean }>
      >,
    [data?.sessionStudents]
  );
  const sessionStaff = useMemo(
    () =>
      (data?.sessionStaff || {}) as Record<
        string,
        Array<any & { planned_absence?: boolean }>
      >,
    [data?.sessionStaff]
  );
  const staffAttendance = useMemo(
    () => (data?.staffAttendance || {}) as Record<string, any[]>,
    [data?.staffAttendance]
  );
  const studentAttendance = useMemo(
    () => (data?.studentAttendance || {}) as Record<string, any[]>,
    [data?.studentAttendance]
  );
  const topics = useMemo(
    () => (data?.topics || {}) as Record<string, any[]>,
    [data?.topics]
  );
  const topicFiles = useMemo(
    () => (data?.topicFiles || {}) as Record<string, any[]>,
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
    return filterTutorLogsByStaff(tutorLogs, staffFilters, staffAttendance);
  }, [tutorLogs, staffFilters, staffAttendance]);

  // Paginated tutor logs
  const paginatedTutorLogs = useMemo(() => {
    return paginateTutorLogs(filteredTutorLogs, page, pageSize);
  }, [filteredTutorLogs, page, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [staffFilters, debouncedSearchTerm, rangeStart, rangeEnd]);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    },
    [sortField]
  );

  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const isDefaultState = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return (
      staffFilters.length === 0 &&
      !searchTerm &&
      (!rangeStart || rangeStart === today) &&
      (!rangeEnd || rangeEnd === today)
    );
  }, [staffFilters.length, searchTerm, rangeStart, rangeEnd]);

  const clearAllFilters = useCallback(() => {
    setStaffFilters([]);
    setSearchTerm('');
    setStaffSearchQuery('');
    setPage(1);
    if (onResetDates) {
      onResetDates();
    }
  }, [onResetDates]);

  return {
    tutorLogs,
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
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    staffFilters,
    toggleStaffFilter,
    staffSearchQuery,
    setStaffSearchQuery,
    filteredStaff,
    page,
    setPage,
    pageSize,
    setPageSize,
    paginatedTutorLogs,
    sortField,
    sortDirection,
    handleSort,
    isLoading,
    isFetching,
    error: error as Error | null,
    refetch,
    clearAllFilters,
    isDefaultState,
  };
}
