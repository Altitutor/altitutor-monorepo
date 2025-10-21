import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { studentsApi } from '../api/students';
import type { Tables, TablesUpdate } from '@altitutor/shared';

// Query Keys
export const studentsKeys = {
  all: ['students'] as const,
  lists: () => [...studentsKeys.all, 'list'] as const,
  list: (filters: string) => [...studentsKeys.lists(), { filters }] as const,
  details: () => [...studentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...studentsKeys.details(), id] as const,
  withDetails: () => [...studentsKeys.all, 'withDetails'] as const,
  withSubjects: () => [...studentsKeys.all, 'withSubjects'] as const,
  byStatus: (status: Tables<'students'>['status']) => [...studentsKeys.all, 'byStatus', status] as const,
  count: () => [...studentsKeys.all, 'count'] as const,
};

// Get all students with details (subjects and classes)
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
  status?: Tables<'students'>['status'] | 'ALL';
  page?: number; // 1-based
  pageSize?: number;
  orderBy?: keyof Tables<'students'>;
  ascending?: boolean;
}

export function useStudentsList(params: UseStudentsListParams) {
  const {
    search = '',
    status = 'ALL',
    page = 1,
    pageSize = 20,
    orderBy = 'last_name',
    ascending = true,
  } = params || {};

  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: [...studentsKeys.lists(), 'paged', { search, status, page, pageSize, orderBy, ascending }],
    queryFn: () => studentsApi.list({ search, status, limit: pageSize, offset, orderBy, ascending }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30s for list pages
    gcTime: 1000 * 60 * 5,
  });
}

// Current page students + details (subjects/classes) for visible rows
export function useStudentsPageWithDetails(params: UseStudentsListParams) {
  const {
    search = '',
    status = 'ALL',
    page = 1,
    pageSize = 20,
    orderBy = 'last_name',
    ascending = true,
  } = params || {};
  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: [...studentsKeys.lists(), 'paged-with-details', { search, status, page, pageSize, orderBy, ascending }],
    queryFn: () => studentsApi.getStudentsWithDetailsPage({ search, status, limit: pageSize, offset, orderBy, ascending }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
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
      const { total } = await studentsApi.list({ limit: 1, offset: 0 });
      return total;
    },
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

// Mutations
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: studentsApi.createStudent,
    onSuccess: (newStudent) => {
      // Invalidate and refetch students lists
      queryClient.invalidateQueries({ queryKey: studentsKeys.all });
      
      // Optimistically add the new student to the cache
      queryClient.setQueryData(studentsKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          students: [...(old.students || []), newStudent],
          studentSubjects: { ...old.studentSubjects, [newStudent.id]: [] },
          studentClasses: { ...old.studentClasses, [newStudent.id]: [] },
        };
      });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'students'> }) =>
      studentsApi.updateStudent(id, data),
    onSuccess: (updatedStudent, { id }) => {
      // Update the student in all relevant caches
      queryClient.setQueryData(studentsKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, student: updatedStudent };
      });

      // Update in the main students list
      queryClient.setQueryData(studentsKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          students: old.students.map((student: Tables<'students'>) =>
            student.id === id ? updatedStudent : student
          ),
        };
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: studentsKeys.all });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: studentsApi.deleteStudent,
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: studentsKeys.detail(deletedId) });
      
      // Remove from lists
      queryClient.setQueryData(studentsKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          students: old.students.filter((student: Tables<'students'>) => student.id !== deletedId),
          studentSubjects: Object.fromEntries(
            Object.entries(old.studentSubjects).filter(([id]) => id !== deletedId)
          ),
          studentClasses: Object.fromEntries(
            Object.entries(old.studentClasses).filter(([id]) => id !== deletedId)
          ),
        };
      });

      // Invalidate all student queries
      queryClient.invalidateQueries({ queryKey: studentsKeys.all });
    },
  });
}

export function useAssignSubjectToStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, subjectId }: { studentId: string; subjectId: string }) =>
      studentsApi.assignSubjectToStudent(studentId, subjectId),
    onSuccess: (_, { studentId, subjectId }) => {
      // Invalidate student details to refetch with new subject
      queryClient.invalidateQueries({ queryKey: studentsKeys.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: studentsKeys.withDetails() });
      queryClient.invalidateQueries({ queryKey: studentsKeys.withSubjects() });
    },
  });
}

export function useRemoveSubjectFromStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, subjectId }: { studentId: string; subjectId: string }) =>
      studentsApi.removeSubjectFromStudent(studentId, subjectId),
    onSuccess: (_, { studentId, subjectId }) => {
      // Invalidate student details to refetch without the subject
      queryClient.invalidateQueries({ queryKey: studentsKeys.detail(studentId) });
      queryClient.invalidateQueries({ queryKey: studentsKeys.withDetails() });
      queryClient.invalidateQueries({ queryKey: studentsKeys.withSubjects() });
    },
  });
} 