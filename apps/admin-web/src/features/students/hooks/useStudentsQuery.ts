import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { studentsApi } from '../api/students';
import type { Tables, TablesUpdate } from '@altitutor/shared';

// Query Keys
export const studentsKeys = {
  all: ['students'] as const,
  lists: () => [...studentsKeys.all, 'list'] as const,
  list: (filters: string) => [...studentsKeys.lists(), { filters }] as const,
  minimal: (params: any) => [...studentsKeys.all, 'minimal', params] as const,
  details: () => [...studentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...studentsKeys.details(), id] as const,
  detailFull: (id: string) => [...studentsKeys.detail(id), 'details'] as const,
  withDetails: () => [...studentsKeys.all, 'withDetails'] as const,
  withSubjects: () => [...studentsKeys.all, 'withSubjects'] as const,
  byStatus: (status: Tables<'students'>['status']) => [...studentsKeys.all, 'byStatus', status] as const,
  count: () => [...studentsKeys.all, 'count'] as const,
};

// For table display - minimal data
export function useStudentsMinimal(params: UseStudentsListParams) {
  const {
    search = '',
    statuses = [],
    curriculums = [],
    yearLevels = [],
    subjectIds = [],
    page = 1,
    pageSize = 20,
    orderBy = 'last_name',
    ascending = true,
  } = params || {};

  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: studentsKeys.minimal({ search, statuses, curriculums, yearLevels, subjectIds, page, pageSize, orderBy, ascending }),
    queryFn: () => studentsApi.listMinimal({ search, statuses, curriculums, yearLevels, subjectIds, limit: pageSize, offset, orderBy, ascending }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 3, // 3 minutes - students list changes infrequently
    gcTime: 1000 * 60 * 5,
  });
}

// For modal - full details
export function useStudentDetails(studentId: string, enabled = true) {
  return useQuery({
    queryKey: studentsKeys.detailFull(studentId),
    queryFn: () => studentsApi.getStudentDetails(studentId),
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60 * 5, // 5 minutes - individual student details are stable
    gcTime: 1000 * 60 * 5,
  });
}

// Get all students with details (subjects and classes)
// DEPRECATED: Use useStudentsMinimal() + useStudentDetails() instead
export function useStudentsWithDetails() {
  return useQuery({
    queryKey: studentsKeys.withDetails(),
    queryFn: studentsApi.getAllStudentsWithDetails,
    staleTime: 1000 * 60 * 2, // 2 minutes - frequently updated data
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get all students (basic)
export function useStudents() {
  return useQuery({
    queryKey: studentsKeys.lists(),
    queryFn: studentsApi.getAllStudents,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Paginated server-filtered students list
export interface UseStudentsListParams {
  search?: string;
  statuses?: Tables<'students'>['status'][];
  curriculums?: string[];
  yearLevels?: number[];
  subjectIds?: string[];
  page?: number; // 1-based
  pageSize?: number;
  orderBy?: keyof Tables<'students'>;
  ascending?: boolean;
}

export function useStudentsList(params: UseStudentsListParams) {
  const {
    search = '',
    statuses = [],
    curriculums = [],
    yearLevels = [],
    subjectIds = [],
    page = 1,
    pageSize = 20,
    orderBy = 'last_name',
    ascending = true,
  } = params || {};

  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: [...studentsKeys.lists(), 'paged', { search, statuses, curriculums, yearLevels, subjectIds, page, pageSize, orderBy, ascending }],
    queryFn: () => studentsApi.list({ search, statuses, curriculums, yearLevels, subjectIds, limit: pageSize, offset, orderBy, ascending }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 3, // 3 minutes - reduce refetch frequency
    gcTime: 1000 * 60 * 5,
  });
}

// Current page students + details (subjects/classes) for visible rows
// DEPRECATED: Use useStudentsMinimal() instead
export function useStudentsPageWithDetails(params: UseStudentsListParams) {
  const {
    search = '',
    statuses = [],
    curriculums = [],
    yearLevels = [],
    subjectIds = [],
    page = 1,
    pageSize = 20,
    orderBy = 'last_name',
    ascending = true,
  } = params || {};
  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: [...studentsKeys.lists(), 'paged-with-details', { search, statuses, curriculums, yearLevels, subjectIds, page, pageSize, orderBy, ascending }],
    queryFn: () => studentsApi.getStudentsWithDetailsPage({ search, statuses, curriculums, yearLevels, subjectIds, limit: pageSize, offset, orderBy, ascending }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 5,
  });
}

// Get single student with subjects
export function useStudentWithSubjects(studentId: string) {
  return useQuery({
    queryKey: studentsKeys.detail(studentId),
    queryFn: () => studentsApi.getStudentWithSubjects(studentId),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get single student (basic)
export function useStudent(studentId: string) {
  return useQuery({
    queryKey: [...studentsKeys.detail(studentId), 'basic'],
    queryFn: () => studentsApi.getStudent(studentId),
    enabled: !!studentId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Search students
export function useStudentsSearch(query: string) {
  return useQuery({
    queryKey: [...studentsKeys.lists(), 'search', query],
    queryFn: () => studentsApi.searchStudents(query),
    enabled: query.length > 0,
    staleTime: 1000 * 30, // 30 seconds for search results
    gcTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Total students count (exact) using head:true pattern in API
export function useStudentsCount() {
  return useQuery({
    queryKey: studentsKeys.count(),
    queryFn: async () => {
      const { total } = await studentsApi.list({ statuses: [], limit: 1, offset: 0 });
      return total;
    },
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

// Active students count (ACTIVE or TRIAL status)
export function useActiveStudentsCount() {
  return useQuery({
    queryKey: [...studentsKeys.all, 'activeCount'],
    queryFn: () => studentsApi.getActiveStudentsCount(),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

// Mutations
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: studentsApi.createStudent,
    onSuccess: () => {
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['students', 'minimal'] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'students'> }) =>
      studentsApi.updateStudent(id, data),
    onSuccess: (updatedStudent, { id }) => {
      // Update specific entity in cache
      queryClient.setQueryData(studentsKeys.detailFull(id), (old: any) => {
        if (!old) return old;
        return { ...old, student: updatedStudent };
      });

      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['students', 'minimal'] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: studentsApi.deleteStudent,
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: studentsKeys.detailFull(deletedId) });
      
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['students', 'minimal'] });
    },
  });
}

export function useAssignSubjectToStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, subjectId }: { studentId: string; subjectId: string }) =>
      studentsApi.assignSubjectToStudent(studentId, subjectId),
    onSuccess: (_, { studentId }) => {
      // Invalidate specific student details
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(studentId) });
    },
  });
}

export function useRemoveSubjectFromStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, subjectId }: { studentId: string; subjectId: string }) =>
      studentsApi.removeSubjectFromStudent(studentId, subjectId),
    onSuccess: (_, { studentId }) => {
      // Invalidate specific student details
      queryClient.invalidateQueries({ queryKey: studentsKeys.detailFull(studentId) });
    },
  });
}

/**
 * Get students for multiple parents
 */
export function useParentStudents(parentIds: string[], enabled = true) {
  return useQuery({
    queryKey: ['parents', 'students', parentIds.sort().join(',')],
    queryFn: () => studentsApi.getParentStudents(parentIds),
    enabled: enabled && parentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
} 