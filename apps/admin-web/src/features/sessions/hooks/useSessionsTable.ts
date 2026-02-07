import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Tables } from '@altitutor/shared';
import { useSessionsWithDetails } from './useSessionsQuery';
import { useStudentSearchForFilter } from './useStudentSearchForFilter';
import {
  formatSessionTableDate,
  formatSessionTimeRange,
  getClassDisplay,
  getClassShortDisplay,
  isDefaultFilterState,
  filterSessionsByStudents,
  filterSessionsByTutorLog,
  paginateSessions,
  canRescheduleSession,
  getFirstStudentIdForReschedule,
} from '../utils/sessionsTableHelpers';

export interface UseSessionsTableProps {
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
}

export interface UseSessionsTableReturn {
  // Filter state
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  debouncedSearchTerm: string;
  studentFilters: string[];
  setStudentFilters: (filters: string[]) => void;
  toggleStudentFilter: (studentId: string) => void;
  typeFilters: string[];
  setTypeFilters: (filters: string[]) => void;
  toggleTypeFilter: (type: string) => void;
  showLogged: boolean;
  setShowLogged: (show: boolean) => void;
  showUnlogged: boolean;
  setShowUnlogged: (show: boolean) => void;
  sortDirection: 'asc' | 'desc';
  toggleSort: () => void;

  // Student search
  studentSearchQuery: string;
  setStudentSearchQuery: (query: string) => void;
  filteredStudents: Tables<'students'>[];

  // Pagination
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;

  // Data
  allSessions: Tables<'sessions'>[];
  filteredSessions: Tables<'sessions'>[];
  paginatedSessions: Tables<'sessions'>[];
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
  sessionStudents: Record<string, Tables<'students'>[]>;
  sessionStaff: Record<string, Tables<'staff'>[]>;
  tutorLogs: Record<string, { id: string; created_by: string; created_by_name: { first_name: string; last_name: string } }>;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;

  // Computed
  isDefaultState: boolean;
  apiStudentId: string | undefined;

  // Actions
  clearAllFilters: () => void;

  // Formatting helpers
  formatDate: (dateString: string) => string;
  getTimeRange: (session: Tables<'sessions'>) => string;
  getClassDisplayName: (session: Tables<'sessions'>) => string;
  getClassShortDisplayName: (session: Tables<'sessions'>) => string;
  canReschedule: (session: Tables<'sessions'>) => boolean;
  getRescheduleStudentId: (sessionId: string) => string | null;
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
  onResetDates,
}: UseSessionsTableProps): UseSessionsTableReturn {
  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [studentFilters, setStudentFilters] = useState<string[]>(initialStudentFilters);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('asc');
  const [showLogged, setShowLogged] = useState(true);
  const [showUnlogged, setShowUnlogged] = useState(true);

  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to first page when search changes
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Student search using RPC hook (supports empty query to show all students)
  const { data: studentSearchData } = useStudentSearchForFilter(
    studentSearchQuery,
    ['ACTIVE', 'TRIAL']
  );

  // Filter students based on search query (client-side filtering of search results)
  // Note: RPC already handles search, but we do additional client-side filtering for better UX
  const filteredStudents = useMemo(() => {
    const allStudents = studentSearchData?.students || [];
    if (!studentSearchQuery.trim()) return allStudents;
    const query = studentSearchQuery.toLowerCase().trim();
    return allStudents.filter((student) => {
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      const school = student.school?.toLowerCase() || '';
      return fullName.includes(query) || school.includes(query);
    });
  }, [studentSearchData?.students, studentSearchQuery]);

  // Toggle student filter
  const toggleStudentFilter = useCallback(
    (studentId: string) => {
      setStudentFilters((prev) => {
        const newFilters = prev.includes(studentId)
          ? prev.filter((id) => id !== studentId)
          : [...prev, studentId];
        setPage(1); // Reset to first page when filter changes
        return newFilters;
      });
    },
    []
  );

  // Toggle type filter
  const toggleTypeFilter = useCallback((type: string) => {
    setTypeFilters((prev) => {
      const newFilters = prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type];
      setPage(1); // Reset to first page when filter changes
      return newFilters;
    });
  }, []);

  // Toggle sort
  const toggleSort = useCallback(() => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  // Determine which student filters to use for API call
  const activeStudentFilters = hideStudentFilter
    ? initialStudentFilters
    : studentFilters;
  const apiStudentId =
    studentId || (activeStudentFilters.length === 1 ? activeStudentFilters[0] : undefined);

  // Fetch sessions data
  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useSessionsWithDetails({
    rangeStart: rangeStart || undefined,
    rangeEnd: rangeEnd || undefined,
    includeInactive: false,
    search: debouncedSearchTerm,
    studentId: apiStudentId,
    staffId,
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

  // Client-side filtering
  const filteredSessions = useMemo(() => {
    if (!allSessions.length) return [];

    let result = [...allSessions];

    // Filter by multiple student IDs (if more than one selected)
    if (activeStudentFilters.length > 1) {
      result = filterSessionsByStudents(result, activeStudentFilters, sessionStudents);
    }

    // Filter by tutor log status
    result = filterSessionsByTutorLog(result, showLogged, showUnlogged, tutorLogs);

    return result;
  }, [
    allSessions,
    activeStudentFilters,
    sessionStudents,
    showLogged,
    showUnlogged,
    tutorLogs,
  ]);

  // Pagination
  const paginatedSessions = useMemo(() => {
    return paginateSessions(filteredSessions, page, pageSize, limit);
  }, [filteredSessions, page, pageSize, limit]);

  // Reset page when filters change (but not when page itself changes)
  // Use refs to track previous values and only reset if filters actually changed
  type FilterState = {
    studentFilters: string[];
    typeFilters: string[];
    debouncedSearchTerm: string;
    rangeStart: string | undefined;
    rangeEnd: string | undefined;
    showLogged: boolean;
    showUnlogged: boolean;
  };
  
  const prevFiltersRef = useRef<FilterState>({
    studentFilters: initialStudentFilters,
    typeFilters: [] as string[],
    debouncedSearchTerm: '',
    rangeStart,
    rangeEnd,
    showLogged: true,
    showUnlogged: true,
  });

  useEffect(() => {
    const currentFilters = {
      studentFilters: hideStudentFilter ? initialStudentFilters : studentFilters,
      typeFilters,
      debouncedSearchTerm,
      rangeStart,
      rangeEnd,
      showLogged,
      showUnlogged,
    };

    // Check if any filter actually changed
    const filtersChanged =
      JSON.stringify(prevFiltersRef.current.studentFilters) !== JSON.stringify(currentFilters.studentFilters) ||
      JSON.stringify(prevFiltersRef.current.typeFilters) !== JSON.stringify(currentFilters.typeFilters) ||
      prevFiltersRef.current.debouncedSearchTerm !== currentFilters.debouncedSearchTerm ||
      prevFiltersRef.current.rangeStart !== currentFilters.rangeStart ||
      prevFiltersRef.current.rangeEnd !== currentFilters.rangeEnd ||
      prevFiltersRef.current.showLogged !== currentFilters.showLogged ||
      prevFiltersRef.current.showUnlogged !== currentFilters.showUnlogged;

    if (filtersChanged) {
      setPage(1);
      prevFiltersRef.current = currentFilters;
    }
  }, [
    studentFilters,
    initialStudentFilters,
    typeFilters,
    debouncedSearchTerm,
    rangeStart,
    rangeEnd,
    showLogged,
    showUnlogged,
    hideStudentFilter,
  ]);

  // Check if filters are in default state
  const isDefaultState = useMemo(() => {
    return isDefaultFilterState(
      studentFilters,
      typeFilters,
      searchTerm,
      rangeStart,
      rangeEnd
    );
  }, [studentFilters, typeFilters, searchTerm, rangeStart, rangeEnd]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setStudentFilters([]);
    setTypeFilters([]);
    setSearchTerm('');
    setStudentSearchQuery('');
    setPage(1);
    if (onResetDates) {
      onResetDates();
    }
  }, [onResetDates]);

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

  const canReschedule = useCallback((session: Tables<'sessions'>) => {
    const hasTutorLog = !!tutorLogs[session.id];
    const rescheduleInfo = getFirstStudentIdForReschedule(session.id, sessionStudents);
    return canRescheduleSession(session, hasTutorLog, rescheduleInfo.hasPaidInvoice);
  }, [tutorLogs, sessionStudents]);

  const getRescheduleStudentId = useCallback(
    (sessionId: string) => {
      const rescheduleInfo = getFirstStudentIdForReschedule(sessionId, sessionStudents);
      return rescheduleInfo.studentId;
    },
    [sessionStudents]
  );

  return {
    // Filter state
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    studentFilters,
    setStudentFilters,
    toggleStudentFilter,
    typeFilters,
    setTypeFilters,
    toggleTypeFilter,
    showLogged,
    setShowLogged,
    showUnlogged,
    setShowUnlogged,
    sortDirection,
    toggleSort,

    // Student search
    studentSearchQuery,
    setStudentSearchQuery,
    filteredStudents,

    // Pagination
    page,
    setPage,
    pageSize,
    setPageSize,

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

    // Computed
    isDefaultState,
    apiStudentId,

    // Actions
    clearAllFilters,

    // Formatting helpers
    formatDate,
    getTimeRange,
    getClassDisplayName,
    getClassShortDisplayName,
    canReschedule,
    getRescheduleStudentId,
  };
}
